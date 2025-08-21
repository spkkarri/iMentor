# FusedChatbot/server/ai_core_service/kg_service.py
"""
Knowledge Graph Service: Handles entity/relation extraction and KG queries.
"""
import logging
import spacy
from neo4j import GraphDatabase, exceptions

# Import config from the parent package
try:
    from . import config
except ImportError:
    # Allow running script directly for testing, assuming config.py is in the same folder
    import config

logger = logging.getLogger(__name__)

class KnowledgeGraphService:
    _driver = None
    _nlp = None

    def __init__(self, uri=config.NEO4J_URI, user=config.NEO4J_USER, password=config.NEO4J_PASSWORD):
        # Initialize the driver and NLP model only if they haven't been already.
        # This makes the class behave like a singleton for these expensive resources.
        if KnowledgeGraphService._driver is None:
            try:
                KnowledgeGraphService._driver = GraphDatabase.driver(uri, auth=(user, password))
                KnowledgeGraphService._driver.verify_connectivity()
                logger.info("Neo4j Driver initialized and connection verified.")
            except exceptions.ServiceUnavailable as e:
                logger.error(f"Could not connect to Neo4j at {uri}: {e}. KG features will be disabled.")
                KnowledgeGraphService._driver = None # Ensure driver is None on failure
            except exceptions.AuthError as e:
                logger.error(f"Neo4j authentication failed for user '{user}': {e}. KG features will be disabled.")
                KnowledgeGraphService._driver = None

        if KnowledgeGraphService._nlp is None:
            try:
                KnowledgeGraphService._nlp = spacy.load("en_core_web_sm")
                logger.info("spaCy model 'en_core_web_sm' loaded successfully.")
            except OSError:
                logger.error("spaCy model 'en_core_web_sm' not found. Please run 'python -m spacy download en_core_web_sm'. KG features will be disabled.")
                KnowledgeGraphService._nlp = None

    def close(self):
        if KnowledgeGraphService._driver is not None:
            KnowledgeGraphService._driver.close()
            logger.info("Neo4j Driver closed.")

    def _ensure_connection(self):
        """Helper to check if both Neo4j and spaCy are available."""
        return KnowledgeGraphService._driver is not None and KnowledgeGraphService._nlp is not None

    def extract_entities_and_relations(self, text):
        """
        Extracts named entities from text using spaCy.
        Note: The small spaCy model does not extract relationships, only entities.
        """
        if not self._ensure_connection():
            return {"entities": [], "relations": []}
        
        doc = self._nlp(text)
        entities = [{"text": ent.text, "label": ent.label_} for ent in doc.ents]
        # A more advanced model would be needed for relation extraction.
        relations = [] 
        return {"entities": entities, "relations": relations}

    def add_to_kg(self, entities, relations=None):
        """
        Adds extracted entities to the KG. Ignores relations for now.
        """
        if not self._ensure_connection() or not entities:
            return False

        try:
            with self._driver.session() as session:
                for ent in entities:
                    # Using MERGE avoids creating duplicate nodes for the same entity.
                    session.run(
                        "MERGE (e:Entity {name: $name, label: $label})",
                        name=ent["text"], label=ent["label"]
                    )
                # Relationship ingestion would go here if `relations` were populated
            logger.info(f"Successfully ingested {len(entities)} entities into the KG.")
            return True
        except exceptions.ServiceUnavailable:
            logger.error("Cannot add to KG, Neo4j is unavailable.")
            return False
        except Exception as e:
            logger.error(f"Failed to add entities to KG: {e}", exc_info=True)
            return False

    def query_kg(self, query_text):
        """
        Extracts entities from the query_text, then searches for those entities and their
        direct relationships in the KG.
        """
        if not self._ensure_connection():
            return {"results": []}

        # First, find entities in the user's question itself.
        extraction = self.extract_entities_and_relations(query_text)
        query_entities = extraction.get("entities", [])
        
        if not query_entities:
            logger.info("No specific entities found in the query to search in KG.")
            return {"results": []}

        all_facts = []
        entity_names_to_query = [ent['text'] for ent in query_entities]

        try:
            with self._driver.session() as session:
                # This Cypher query finds the entities mentioned and any direct relationships they have.
                result = session.run("""
                    UNWIND $entity_names AS entity_name
                    MATCH (e:Entity)
                    WHERE toLower(e.name) = toLower(entity_name)
                    OPTIONAL MATCH (e)-[r]-(related_entity)
                    RETURN e.name AS entity, e.label as label, type(r) as relationship, related_entity.name as related_name
                """, {"entity_names": entity_names_to_query})
                
                records = list(result)
                if records:
                    logger.info(f"KG query found {len(records)} potential facts for entities: {entity_names_to_query}")
                
                for record in records:
                    fact = f"Entity '{record['entity']}' (Type: {record['label']})"
                    if record['relationship'] and record['related_name']:
                        # Format the relationship to be more human-readable
                        fact += f" is '{record['relationship'].replace('_', ' ').lower()}' '{record['related_name']}'."
                    else:
                        fact += " exists in the knowledge base."
                    all_facts.append(fact)

            # Return unique facts using dict.fromkeys to preserve order and remove duplicates
            return {"results": list(dict.fromkeys(all_facts))}
        except exceptions.ServiceUnavailable:
            logger.error("Cannot query KG, Neo4j is unavailable.")
            return {"results": []}
        except Exception as e:
            logger.error(f"An error occurred during KG query: {e}", exc_info=True)
            return {"results": []}