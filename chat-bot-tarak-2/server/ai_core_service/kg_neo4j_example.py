# Neo4j Knowledge Graph Integration Example
# This script demonstrates how to connect to Neo4j, create nodes/relationships, and query the KG.
# Requirements: pip install neo4j spacy
# For entity extraction: python -m spacy download en_core_web_sm

from neo4j import GraphDatabase
import spacy

# --- Neo4j Connection Setup ---
NEO4J_URI = "bolt://localhost:7687"
NEO4J_USER = "neo4j"
NEO4J_PASSWORD = "password"  # Change to your Neo4j password

driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))

# --- Entity Extraction Example (spaCy) ---
nlp = spacy.load("en_core_web_sm")

def extract_entities(text):
    doc = nlp(text)
    entities = [(ent.text, ent.label_) for ent in doc.ents]
    return entities

# --- Ingest Entities into Neo4j ---
def ingest_entities(entities):
    with driver.session() as session:
        for ent_text, ent_label in entities:
            session.run(
                "MERGE (e:Entity {name: $name, label: $label})",
                name=ent_text, label=ent_label
            )

# --- Example Relationship Ingestion (manual for demo) ---
def create_relationship(entity1, entity2, rel_type):
    with driver.session() as session:
        session.run(
            "MATCH (a:Entity {name: $e1}), (b:Entity {name: $e2}) "
            "MERGE (a)-[r:%s]->(b)" % rel_type,
            e1=entity1, e2=entity2
        )

# --- Query the KG ---
def query_kg(query):
    with driver.session() as session:
        result = session.run(query)
        return [record.data() for record in result]

# --- Example Usage ---
if __name__ == "__main__":
    sample_text = "Albert Einstein was born in Ulm. He developed the theory of relativity in Germany."
    entities = extract_entities(sample_text)
    print("Extracted entities:", entities)
    ingest_entities(entities)
    # Example: create a relationship manually
    create_relationship("Albert Einstein", "Ulm", "BORN_IN")
    # Query all entities
    print(query_kg("MATCH (e:Entity) RETURN e.name, e.label"))
    # Query all relationships
    print(query_kg("MATCH (a)-[r]->(b) RETURN a.name, type(r), b.name"))

driver.close()
