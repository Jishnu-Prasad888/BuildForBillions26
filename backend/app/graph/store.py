"""Knowledge graph access.

Primary backend is Neo4j. If Neo4j is unreachable (e.g. running the backend
without Docker), an in-memory graph with the same interface is used so the demo
keeps working; /api/health reports which backend is active.

Schema (kept deliberately small):
  (:LifeEvent)-[:MATCHES]->(:Scheme)
  (:Scheme)-[:HAS_RULE]->(:EligibilityRule)-[:SUPPORTED_BY]->(:Document)
  (:Scheme)-[:REQUIRES]->(:DocumentRequirement)
  (:Scheme)-[:MANAGED_BY]->(:Department)
  (:Scheme)-[:AVAILABLE_IN]->(:State)
  (:Scheme)-[:APPLY_AT]->(:Portal)
  (:Scheme)-[:DESCRIBED_IN]->(:Document)
  (:Document)-[:FROM_SOURCE]->(:Source)
"""
from __future__ import annotations

import copy
import json
import logging
import threading
from abc import ABC, abstractmethod
from functools import lru_cache

from app.config import settings

log = logging.getLogger(__name__)


class GraphStore(ABC):
    backend = "base"

    @abstractmethod
    def seed(self, data: dict) -> None: ...
    @abstractmethod
    def life_events(self) -> list[dict]: ...
    @abstractmethod
    def list_schemes(self) -> list[dict]: ...
    @abstractmethod
    def get_scheme(self, code: str) -> dict | None: ...
    @abstractmethod
    def schemes_for_life_event(self, code: str, state: str | None = None) -> list[dict]: ...
    @abstractmethod
    def upsert_document(self, doc_id: str, title: str, source_name: str, publisher: str, scheme_codes: list[str]) -> None: ...
    @abstractmethod
    def remove_document(self, doc_id: str) -> None: ...
    @abstractmethod
    def upsert_scheme(self, scheme: dict) -> None: ...
    @abstractmethod
    def stats(self) -> dict: ...
    @abstractmethod
    def is_empty(self) -> bool: ...
    @abstractmethod
    def graph_view(self, scheme_code: str | None = None) -> dict: ...


# ---------------------------------------------------------------------------
# In-memory implementation (fallback)
# ---------------------------------------------------------------------------
class MemoryGraph(GraphStore):
    backend = "memory"

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.data: dict = {"life_events": [], "departments": [], "states": [], "portals": [], "document_requirements": [], "schemes": []}
        self.documents: dict[str, dict] = {}  # doc_id -> {title, source, publisher, schemes}

    def seed(self, data: dict) -> None:
        with self._lock:
            for key in self.data:
                self.data[key] = copy.deepcopy(data.get(key, []))

    def is_empty(self) -> bool:
        return not self.data["schemes"]

    def _idx(self, key: str) -> dict:
        return {x["code"]: x for x in self.data[key]}

    def _expand(self, s: dict) -> dict:
        depts, portals, docs, states = self._idx("departments"), self._idx("portals"), self._idx("document_requirements"), self._idx("states")
        source_docs = sorted({s.get("source_doc")} - {None} | {d for d, meta in self.documents.items() if s["code"] in meta["schemes"]})
        return {
            "code": s["code"], "name": s["name"], "names": s.get("names", {}), "short_name": s.get("short_name", s["name"]),
            "summary": s.get("summary", ""), "benefit": s.get("benefit", ""), "form_id": s.get("form_id"),
            "life_events": s.get("life_events", []),
            "department": depts.get(s.get("department")),
            "portal": portals.get(s.get("portal")),
            "states": [states[c] for c in s.get("states", []) if c in states],
            "rules": [dict(r) for r in s.get("rules", [])],
            "documents": [docs[c] for c in s.get("documents", []) if c in docs],
            "source_docs": source_docs,
        }

    def life_events(self) -> list[dict]:
        return copy.deepcopy(self.data["life_events"])

    def list_schemes(self) -> list[dict]:
        return [self._expand(s) for s in self.data["schemes"]]

    def get_scheme(self, code: str) -> dict | None:
        s = self._idx("schemes").get(code)
        return self._expand(s) if s else None

    def schemes_for_life_event(self, code: str, state: str | None = None) -> list[dict]:
        out = []
        for s in self.data["schemes"]:
            if code in s.get("life_events", []):
                if state and s.get("states") and not ({state, "IN"} & set(s["states"])):
                    continue
                out.append(self._expand(s))
        return out

    def upsert_document(self, doc_id, title, source_name, publisher, scheme_codes) -> None:
        with self._lock:
            self.documents[doc_id] = {"title": title, "source": source_name, "publisher": publisher, "schemes": list(scheme_codes)}

    def remove_document(self, doc_id: str) -> None:
        self.documents.pop(doc_id, None)

    def upsert_scheme(self, scheme: dict) -> None:
        with self._lock:
            self.data["schemes"] = [s for s in self.data["schemes"] if s["code"] != scheme["code"]] + [scheme]

    def stats(self) -> dict:
        return {
            "backend": self.backend,
            "life_events": len(self.data["life_events"]),
            "schemes": len(self.data["schemes"]),
            "rules": sum(len(s.get("rules", [])) for s in self.data["schemes"]),
            "departments": len(self.data["departments"]),
            "document_requirements": len(self.data["document_requirements"]),
            "documents": len(self.documents),
        }

    def graph_view(self, scheme_code: str | None = None) -> dict:
        nodes: dict[str, dict] = {}
        edges: list[dict] = []

        def node(i, label, name):
            nodes[i] = {"id": i, "label": label, "name": name}

        for le in self.data["life_events"]:
            node(f"le:{le['code']}", "LifeEvent", le["name"])
        for s in self.list_schemes():
            if scheme_code and s["code"] != scheme_code:
                continue
            sid = f"s:{s['code']}"
            node(sid, "Scheme", s.get("short_name") or s["name"])
            for le in s["life_events"]:
                node(f"le:{le}", "LifeEvent", next((x["name"] for x in self.data["life_events"] if x["code"] == le), le))
                edges.append({"from": f"le:{le}", "to": sid, "type": "MATCHES"})
            if s["department"]:
                node(f"d:{s['department']['code']}", "Department", s["department"]["name"])
                edges.append({"from": sid, "to": f"d:{s['department']['code']}", "type": "MANAGED_BY"})
            for r in s["rules"]:
                node(f"r:{r['code']}", "EligibilityRule", r["text"])
                edges.append({"from": sid, "to": f"r:{r['code']}", "type": "HAS_RULE"})
                if r.get("supported_by"):
                    node(f"doc:{r['supported_by']}", "Document", r["supported_by"])
                    edges.append({"from": f"r:{r['code']}", "to": f"doc:{r['supported_by']}", "type": "SUPPORTED_BY"})
            for d in s["documents"]:
                node(f"dr:{d['code']}", "DocumentRequirement", d["name"])
                edges.append({"from": sid, "to": f"dr:{d['code']}", "type": "REQUIRES"})
            if s["portal"]:
                node(f"p:{s['portal']['code']}", "Portal", s["portal"]["name"])
                edges.append({"from": sid, "to": f"p:{s['portal']['code']}", "type": "APPLY_AT"})
            for st in s["states"]:
                node(f"st:{st['code']}", "State", st["name"])
                edges.append({"from": sid, "to": f"st:{st['code']}", "type": "AVAILABLE_IN"})
            for d in s["source_docs"]:
                title = self.documents.get(d, {}).get("title", d)
                node(f"doc:{d}", "Document", title)
                edges.append({"from": sid, "to": f"doc:{d}", "type": "DESCRIBED_IN"})
        return {"nodes": list(nodes.values()), "edges": edges}


# ---------------------------------------------------------------------------
# Neo4j implementation
# ---------------------------------------------------------------------------
class Neo4jGraph(GraphStore):
    backend = "neo4j"

    def __init__(self, driver) -> None:
        self.driver = driver

    def _run(self, cypher: str, **params) -> list[dict]:
        with self.driver.session() as session:
            return [r.data() for r in session.run(cypher, **params)]

    def is_empty(self) -> bool:
        return self._run("MATCH (s:Scheme) RETURN count(s) AS n")[0]["n"] == 0

    def seed(self, data: dict) -> None:
        for c in ["LifeEvent", "Scheme", "EligibilityRule", "DocumentRequirement", "Department", "State", "Portal"]:
            self._run(f"CREATE CONSTRAINT IF NOT EXISTS FOR (n:{c}) REQUIRE n.code IS UNIQUE")
        self._run("CREATE CONSTRAINT IF NOT EXISTS FOR (n:Document) REQUIRE n.key IS UNIQUE")
        self._run("CREATE CONSTRAINT IF NOT EXISTS FOR (n:Source) REQUIRE n.name IS UNIQUE")
        for le in data.get("life_events", []):
            self._run(
                "MERGE (n:LifeEvent {code:$code}) SET n.name=$name, n.description=$description, n.context=$context, "
                "n.names_json=$names, n.keywords_json=$keywords",
                code=le["code"], name=le["name"], description=le.get("description", ""), context=le.get("context", ""),
                names=json.dumps(le.get("names", {}), ensure_ascii=False), keywords=json.dumps(le.get("keywords", {}), ensure_ascii=False),
            )
        for d in data.get("departments", []):
            self._run("MERGE (n:Department {code:$code}) SET n.name=$name, n.level=$level, n.category=$category "
                      "FOREACH (_ IN CASE WHEN $category <> '' THEN [1] ELSE [] END | SET n:GovernmentDepartment)", **{"level": "", "category": "", **d})
        for s in data.get("states", []):
            self._run("MERGE (n:State {code:$code}) SET n.name=$name", **s)
        for p in data.get("portals", []):
            self._run("MERGE (n:Portal {code:$code}) SET n.name=$name, n.url=$url", **p)
        for i, d in enumerate(data.get("document_requirements", [])):
            self._run("MERGE (n:DocumentRequirement {code:$code}) SET n.name=$name, n.names_json=$names, n.wallet_types=$wt, n.pos=$pos",
                      code=d["code"], name=d["name"], names=json.dumps(d.get("names", {}), ensure_ascii=False), wt=d.get("wallet_types", []), pos=i)
        for s in data.get("schemes", []):
            self.upsert_scheme(s)

    def upsert_scheme(self, s: dict) -> None:
        self._run(
            "MERGE (n:Scheme {code:$code}) SET n.name=$name, n.names_json=$names, n.short_name=$short_name, "
            "n.summary=$summary, n.benefit=$benefit, n.form_id=$form_id",
            code=s["code"], name=s["name"], names=json.dumps(s.get("names", {}), ensure_ascii=False),
            short_name=s.get("short_name", s["name"]), summary=s.get("summary", ""), benefit=s.get("benefit", ""), form_id=s.get("form_id"),
        )
        self._run("MATCH (s:Scheme {code:$code})-[r:MATCHES|MANAGED_BY|AVAILABLE_IN|APPLY_AT|REQUIRES]-() DELETE r", code=s["code"])
        for le in s.get("life_events", []):
            self._run("MATCH (s:Scheme {code:$code}) MERGE (l:LifeEvent {code:$le}) MERGE (l)-[:MATCHES]->(s)", code=s["code"], le=le)
        if s.get("department"):
            self._run("MATCH (s:Scheme {code:$code}), (d:Department {code:$d}) MERGE (s)-[:MANAGED_BY]->(d)", code=s["code"], d=s["department"])
        for st in s.get("states", []):
            self._run("MATCH (s:Scheme {code:$code}), (x:State {code:$st}) MERGE (s)-[:AVAILABLE_IN]->(x)", code=s["code"], st=st)
        if s.get("portal"):
            self._run("MATCH (s:Scheme {code:$code}), (p:Portal {code:$p}) MERGE (s)-[:APPLY_AT]->(p)", code=s["code"], p=s["portal"])
        for d in s.get("documents", []):
            self._run("MATCH (s:Scheme {code:$code}), (d:DocumentRequirement {code:$d}) MERGE (s)-[:REQUIRES]->(d)", code=s["code"], d=d)
        for r in s.get("rules", []):
            self._run(
                "MATCH (s:Scheme {code:$code}) MERGE (r:EligibilityRule {code:$rc}) SET r.text=$text, r.field=$field "
                "MERGE (s)-[:HAS_RULE]->(r)",
                code=s["code"], rc=r["code"], text=r["text"], field=r.get("field", ""),
            )
            if r.get("supported_by"):
                self._run("MATCH (r:EligibilityRule {code:$rc}) MERGE (d:Document {key:$key}) MERGE (r)-[:SUPPORTED_BY]->(d)",
                          rc=r["code"], key=r["supported_by"])
        if s.get("source_doc"):
            self._run("MATCH (s:Scheme {code:$code}) MERGE (d:Document {key:$key}) MERGE (s)-[:DESCRIBED_IN]->(d)", code=s["code"], key=s["source_doc"])

    _SCHEME_Q = """
    MATCH (s:Scheme) WHERE $code IS NULL OR s.code = $code
    OPTIONAL MATCH (s)-[:MANAGED_BY]->(d:Department)
    OPTIONAL MATCH (s)-[:APPLY_AT]->(p:Portal)
    WITH s, d, p
    OPTIONAL MATCH (s)-[:HAS_RULE]->(r:EligibilityRule)
    OPTIONAL MATCH (r)-[:SUPPORTED_BY]->(rd:Document)
    WITH s, d, p, collect(DISTINCT CASE WHEN r IS NULL THEN NULL ELSE {code:r.code, text:r.text, field:r.field, supported_by:rd.key} END) AS rules
    OPTIONAL MATCH (s)-[:REQUIRES]->(dr:DocumentRequirement)
    WITH s, d, p, rules, collect(DISTINCT CASE WHEN dr IS NULL THEN NULL ELSE {code:dr.code, name:dr.name, names_json:dr.names_json, wallet_types:dr.wallet_types, pos:coalesce(dr.pos, 99)} END) AS docs
    OPTIONAL MATCH (s)-[:AVAILABLE_IN]->(st:State)
    WITH s, d, p, rules, docs, collect(DISTINCT CASE WHEN st IS NULL THEN NULL ELSE {code:st.code, name:st.name} END) AS states
    OPTIONAL MATCH (le:LifeEvent)-[:MATCHES]->(s)
    WITH s, d, p, rules, docs, states, collect(DISTINCT le.code) AS les
    OPTIONAL MATCH (s)-[:DESCRIBED_IN]->(sd:Document)
    RETURN s{.*} AS s, d{.*} AS d, p{.*} AS p, rules, docs, states, les, collect(DISTINCT sd.key) AS source_docs
    ORDER BY s.code
    """

    def _rows_to_schemes(self, rows: list[dict]) -> list[dict]:
        out = []
        for row in rows:
            s = row["s"]
            out.append({
                "code": s["code"], "name": s["name"], "names": json.loads(s.get("names_json") or "{}"),
                "short_name": s.get("short_name") or s["name"], "summary": s.get("summary", ""), "benefit": s.get("benefit", ""),
                "form_id": s.get("form_id"), "life_events": row["les"],
                "department": row["d"], "portal": row["p"], "states": row["states"],
                "rules": sorted(row["rules"], key=lambda r: r["code"]),
                "documents": [{"code": d["code"], "name": d["name"], "names": json.loads(d.get("names_json") or "{}"), "wallet_types": d.get("wallet_types") or []}
                              for d in sorted(row["docs"], key=lambda d: d.get("pos", 99))],
                "source_docs": sorted(row["source_docs"]),
            })
        return out

    def life_events(self) -> list[dict]:
        rows = self._run("MATCH (l:LifeEvent) RETURN l{.*} AS l")
        return [{**r["l"], "names": json.loads(r["l"].get("names_json") or "{}"), "keywords": json.loads(r["l"].get("keywords_json") or "{}")} for r in rows]

    def list_schemes(self) -> list[dict]:
        return self._rows_to_schemes(self._run(self._SCHEME_Q, code=None))

    def get_scheme(self, code: str) -> dict | None:
        rows = self._rows_to_schemes(self._run(self._SCHEME_Q, code=code))
        return rows[0] if rows else None

    def schemes_for_life_event(self, code: str, state: str | None = None) -> list[dict]:
        codes = [r["code"] for r in self._run(
            "MATCH (l:LifeEvent {code:$code})-[:MATCHES]->(s:Scheme) "
            "OPTIONAL MATCH (s)-[:AVAILABLE_IN]->(st:State) WITH s, collect(st.code) AS sts "
            "WHERE $state IS NULL OR size(sts) = 0 OR $state IN sts OR 'IN' IN sts RETURN s.code AS code ORDER BY code",
            code=code, state=state)]
        return [s for s in self.list_schemes() if s["code"] in codes]

    def upsert_document(self, doc_id, title, source_name, publisher, scheme_codes) -> None:
        self._run("MERGE (d:Document {key:$key}) SET d.title=$title, d.publisher=$publisher "
                  "MERGE (src:Source {name:$source}) MERGE (d)-[:FROM_SOURCE]->(src)",
                  key=doc_id, title=title, publisher=publisher, source=source_name or publisher or "Unknown")
        for code in scheme_codes:
            self._run("MATCH (s:Scheme {code:$code}), (d:Document {key:$key}) MERGE (s)-[:DESCRIBED_IN]->(d)", code=code, key=doc_id)

    def remove_document(self, doc_id: str) -> None:
        self._run("MATCH (d:Document {key:$key}) WHERE NOT (d)<-[:SUPPORTED_BY]-() DETACH DELETE d", key=doc_id)

    def stats(self) -> dict:
        q = lambda label: self._run(f"MATCH (n:{label}) RETURN count(n) AS n")[0]["n"]  # noqa: E731
        return {
            "backend": self.backend, "life_events": q("LifeEvent"), "schemes": q("Scheme"), "rules": q("EligibilityRule"),
            "departments": q("Department"), "document_requirements": q("DocumentRequirement"), "documents": q("Document"),
        }

    def graph_view(self, scheme_code: str | None = None) -> dict:
        rows = self._run(
            "MATCH (s:Scheme) WHERE $code IS NULL OR s.code=$code "
            "MATCH p=(s)-[*1..2]-(n) WHERE NOT n:Scheme OR n=s "
            "UNWIND relationships(p) AS r "
            "WITH DISTINCT r, startNode(r) AS a, endNode(r) AS b "
            "RETURN elementId(a) AS aid, labels(a)[0] AS al, coalesce(a.short_name, a.name, a.text, a.title, a.key) AS an, "
            "elementId(b) AS bid, labels(b)[0] AS bl, coalesce(b.short_name, b.name, b.text, b.title, b.key) AS bn, type(r) AS t",
            code=scheme_code)
        nodes, edges = {}, []
        for r in rows:
            nodes[r["aid"]] = {"id": r["aid"], "label": r["al"], "name": r["an"]}
            nodes[r["bid"]] = {"id": r["bid"], "label": r["bl"], "name": r["bn"]}
            edges.append({"from": r["aid"], "to": r["bid"], "type": r["t"]})
        return {"nodes": list(nodes.values()), "edges": edges}


@lru_cache
def get_graph() -> GraphStore:
    import time

    from neo4j import GraphDatabase

    last_exc: Exception | None = None
    for attempt in range(max(1, settings.NEO4J_CONNECT_RETRIES)):
        try:
            driver = GraphDatabase.driver(settings.NEO4J_URI, auth=(settings.NEO4J_USERNAME, settings.NEO4J_PASSWORD), connection_timeout=5)
            driver.verify_connectivity()
            log.info("Connected to Neo4j at %s", settings.NEO4J_URI)
            return Neo4jGraph(driver)
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            if attempt + 1 < settings.NEO4J_CONNECT_RETRIES:
                time.sleep(3)
    log.warning("Neo4j unavailable (%s). Using in-memory graph fallback.", last_exc)
    return MemoryGraph()
