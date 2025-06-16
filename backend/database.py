# --- START OF FILE database.py ---

import logging
import json
import uuid
from datetime import datetime, timezone
from pymongo import MongoClient,errors as pymongo_errors
from pymongo.collection import Collection
from bson import ObjectId

from config import (
    MONGO_URI, MONGO_DB_NAME, MONGO_USERS_COLLECTION, # CORRECTED TYPO
    MONGO_DOCUMENTS_COLLECTION, MONGO_CHAT_THREADS_COLLECTION,
    MONGO_THREAD_MESSAGES_COLLECTION
)

logger = logging.getLogger(__name__)

mongo_client: MongoClient | None = None
db = None

def get_db_connection():
    global mongo_client, db
    if db is not None and mongo_client is not None:
        try:
            mongo_client.admin.command('ping')
            return db
        except pymongo_errors.ConnectionFailure:
            logger.warning("MongoDB connection lost. Attempting to reconnect.")
            mongo_client = None
            db = None
        except Exception as e:
            logger.error(f"Unexpected error with existing MongoDB connection during ping: {e}. Attempting to reconnect.")
            mongo_client = None
            db = None

    try:
        logger.info(f"Attempting to connect to MongoDB: {MONGO_URI}")
        mongo_client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        mongo_client.admin.command('ismaster')
        db = mongo_client[MONGO_DB_NAME]
        logger.info(f"MongoDB connection successful. Using database: '{MONGO_DB_NAME}'")
        return db
    except pymongo_errors.ServerSelectionTimeoutError as e:
        logger.error(f"MongoDB connection timed out to {MONGO_URI}: {e}", exc_info=True)
        mongo_client = None
        db = None
        return None
    except pymongo_errors.ConnectionFailure as e:
        logger.error(f"MongoDB connection failed to {MONGO_URI}: {e}", exc_info=True)
        mongo_client = None
        db = None
        return None
    except Exception as e:
        logger.error(f"An unexpected error occurred during MongoDB connection: {e}", exc_info=True)
        mongo_client = None
        db = None
        return None

def init_db():
    try:
        database = get_db_connection()
        if database is None:
            logger.critical("Cannot initialize DB: No database connection available.")
            return False

        logger.info(f"Initializing MongoDB collections and indexes in '{MONGO_DB_NAME}'...")

        users_collection: Collection = database[MONGO_USERS_COLLECTION]
        if MONGO_USERS_COLLECTION not in database.list_collection_names():
            logger.info(f"Creating '{MONGO_USERS_COLLECTION}' collection.")
        if "username_1" not in users_collection.index_information():
            users_collection.create_index("username", unique=True)
            logger.info(f"Created unique index on 'username' in '{MONGO_USERS_COLLECTION}'.")
        if "email_1" not in users_collection.index_information():
            users_collection.create_index("email", unique=True)
            logger.info(f"Created unique index on 'email' in '{MONGO_USERS_COLLECTION}'.")

        documents_collection: Collection = database[MONGO_DOCUMENTS_COLLECTION]
        if MONGO_DOCUMENTS_COLLECTION not in database.list_collection_names():
            logger.info(f"Creating '{MONGO_DOCUMENTS_COLLECTION}' collection.")
        if "user_id_1_filename_1" not in documents_collection.index_information():
            documents_collection.create_index([("user_id", 1), ("filename", 1)], unique=True)
            logger.info(f"Created unique index on 'user_id, filename' in '{MONGO_DOCUMENTS_COLLECTION}'.")
        if "user_id_1" not in documents_collection.index_information():
            documents_collection.create_index("user_id")
            logger.info(f"Created index on 'user_id' in '{MONGO_DOCUMENTS_COLLECTION}'.")

        chat_threads_collection: Collection = database[MONGO_CHAT_THREADS_COLLECTION]
        if MONGO_CHAT_THREADS_COLLECTION not in database.list_collection_names():
             logger.info(f"Creating '{MONGO_CHAT_THREADS_COLLECTION}' collection.")
        if "user_id_1_thread_id_1" not in chat_threads_collection.index_information():
             chat_threads_collection.create_index([("user_id", 1), ("thread_id", 1)], unique=True)
             logger.info(f"Created unique index on 'user_id, thread_id' in '{MONGO_CHAT_THREADS_COLLECTION}'.")
        if "user_id_1" not in chat_threads_collection.index_information():
             chat_threads_collection.create_index("user_id")
             logger.info(f"Created index on 'user_id' in '{MONGO_CHAT_THREADS_COLLECTION}'.")
        if "last_updated_1" not in chat_threads_collection.index_information():
             chat_threads_collection.create_index("last_updated")
             logger.info(f"Created index on 'last_updated' in '{MONGO_CHAT_THREADS_COLLECTION}'.")

        thread_messages_collection: Collection = database[MONGO_THREAD_MESSAGES_COLLECTION]
        if MONGO_THREAD_MESSAGES_COLLECTION not in database.list_collection_names():
             logger.info(f"Creating '{MONGO_THREAD_MESSAGES_COLLECTION}' collection.")
        if "user_id_1_thread_id_1_timestamp_1" not in thread_messages_collection.index_information():
             thread_messages_collection.create_index([("user_id", 1), ("thread_id", 1), ("timestamp", 1)])
             logger.info(f"Created index on 'user_id, thread_id, timestamp' in '{MONGO_THREAD_MESSAGES_COLLECTION}'.")
        if "user_id_1" not in thread_messages_collection.index_information():
             thread_messages_collection.create_index("user_id")
             logger.info(f"Created index on 'user_id' in '{MONGO_THREAD_MESSAGES_COLLECTION}'.")

        logger.info(f"MongoDB collections and indexes checked/created for '{MONGO_DB_NAME}'.")
        return True

    except pymongo_errors.PyMongoError as e:
        logger.error(f"MongoDB schema initialization/update error: {e}", exc_info=True)
        return False
    except Exception as e:
        logger.error(f"Unexpected error during DB initialization: {e}", exc_info=True)
        return False


def create_user(username: str, hashed_password: str, email: str, firstname: str, lastname: str,
                gender: str | None, mobile: str | None, organization: str | None) -> str | None:
    try:
        
        
        database = get_db_connection()
        if database is None: return None
        users_collection: Collection = database[MONGO_USERS_COLLECTION]
        user_doc = {
            "username": username, "password_hash": hashed_password, "email": email,
            "firstname": firstname, "lastname": lastname, "gender": gender,
            "mobile": mobile, "organization": organization,
            "created_at": datetime.now(timezone.utc)
        }
        result = users_collection.insert_one(user_doc)
        logger.info(f"User '{username}' created with ID: {result.inserted_id}")
        return str(result.inserted_id)
    except pymongo_errors.DuplicateKeyError:
        logger.warning(f"Attempted to create user with duplicate username or email: {username}/{email}")
        return None
    except pymongo_errors.PyMongoError as e:
        logger.error(f"MongoDB error creating user '{username}': {e}", exc_info=True)
        return None

def get_user_by_username(username: str) -> dict | None:
    try:
        database = get_db_connection()
        if database is None: return None
        users_collection: Collection = database[MONGO_USERS_COLLECTION]
        user = users_collection.find_one({"username": username})
        if user: user['_id'] = str(user['_id'])
        return user
    except pymongo_errors.PyMongoError as e:
        logger.error(f"MongoDB error fetching user by username '{username}': {e}", exc_info=True)
        return None

def get_user_by_id(user_id_str: str) -> dict | None:
    try:
        if not ObjectId.is_valid(user_id_str):
            logger.warning(f"Invalid user_id format '{user_id_str}' for MongoDB query.")
            return None
        database = get_db_connection()
        if database is None: return None
        users_collection: Collection = database[MONGO_USERS_COLLECTION]
        user = users_collection.find_one({"_id": ObjectId(user_id_str)})
        if user: user['_id'] = str(user['_id'])
        return user
    except pymongo_errors.PyMongoError as e:
        logger.error(f"MongoDB error fetching user by ID '{user_id_str}': {e}", exc_info=True)
        return None

def get_user_by_email(email: str) -> dict | None:
    try:
        database = get_db_connection()
        if database is None: return None
        users_collection: Collection = database[MONGO_USERS_COLLECTION]
        user = users_collection.find_one({"email": email})
        if user: user['_id'] = str(user['_id'])
        return user
    except pymongo_errors.PyMongoError as e:
        logger.error(f"MongoDB error fetching user by email '{email}': {e}", exc_info=True)
        return None

def add_user_document_record(user_id_str: str, filename: str, original_filename: str, file_path: str, pdf_type: str = "general") -> str | None:
    try:
        if not ObjectId.is_valid(user_id_str):
            logger.error(f"Invalid user_id format '{user_id_str}' for adding document record.")
            return None
        database = get_db_connection()
        if database is None: return None
        documents_collection: Collection = database[MONGO_DOCUMENTS_COLLECTION]
        doc_record = {
            "user_id": ObjectId(user_id_str), "filename": filename,
            "original_filename": original_filename, "file_path": file_path,
            "pdf_type": pdf_type, "uploaded_at": datetime.now(timezone.utc),
            "faiss_indexed": False
        }
        result = documents_collection.update_one(
             {"user_id": ObjectId(user_id_str), "filename": filename},
             {"$set": doc_record},
             upsert=True
        )
        if result.upserted_id:
             logger.info(f"Document record inserted for user '{user_id_str}', file '{filename}', type '{pdf_type}', ID: {result.upserted_id}")
             return str(result.upserted_id)
        elif result.modified_count > 0 or result.matched_count > 0:
             existing_doc = documents_collection.find_one({"user_id": ObjectId(user_id_str), "filename": filename})
             logger.info(f"Document record updated for user '{user_id_str}', file '{filename}', type '{pdf_type}', ID: {existing_doc['_id'] if existing_doc else 'N/A'}")
             return str(existing_doc["_id"]) if existing_doc else None
        else:
             logger.error(f"Failed to insert or update document record for user '{user_id_str}', file '{filename}'. Result: {result.raw_result}")
             return None
    except pymongo_errors.PyMongoError as e:
        logger.error(f"MongoDB error adding/updating document record for user '{user_id_str}', file '{filename}': {e}", exc_info=True)
        return None

def get_user_documents(user_id_str: str) -> list[dict]:
    docs_out = []
    try:
        if not ObjectId.is_valid(user_id_str):
            logger.warning(f"Invalid user_id format '{user_id_str}' for get_user_documents.")
            return []
        database = get_db_connection()
        if database is None: return []
        documents_collection: Collection = database[MONGO_DOCUMENTS_COLLECTION]
        user_docs_cursor = documents_collection.find({"user_id": ObjectId(user_id_str)}).sort("uploaded_at", -1)
        for doc in user_docs_cursor:
            doc["_id"] = str(doc["_id"])
            doc["user_id"] = str(doc["user_id"])
            doc["uploaded_at"] = doc["uploaded_at"].isoformat().replace('+00:00', 'Z') if isinstance(doc["uploaded_at"], datetime) else str(doc["uploaded_at"])
            docs_out.append(doc)
        return docs_out
    except pymongo_errors.PyMongoError as e:
        logger.error(f"MongoDB error fetching documents for user '{user_id_str}': {e}", exc_info=True)
        return []

def get_document_by_filename(user_id_str: str, filename: str) -> dict | None:
    try:
        if not ObjectId.is_valid(user_id_str):
            logger.warning(f"Invalid user_id format '{user_id_str}' for get_document_by_filename.")
            return None
        database = get_db_connection()
        if database is None: return None
        documents_collection: Collection = database[MONGO_DOCUMENTS_COLLECTION]
        doc = documents_collection.find_one({"user_id": ObjectId(user_id_str), "filename": filename})
        if doc:
            doc["_id"] = str(doc["_id"])
            doc["user_id"] = str(doc["user_id"])
            doc["uploaded_at"] = doc["uploaded_at"].isoformat().replace('+00:00', 'Z') if isinstance(doc["uploaded_at"], datetime) else str(doc["uploaded_at"])
        return doc
    except pymongo_errors.PyMongoError as e:
        logger.error(f"MongoDB error fetching document '{filename}' for user '{user_id_str}': {e}", exc_info=True)
        return None

def mark_document_indexed(doc_id_str: str, indexed: bool = True):
    try:
        if not ObjectId.is_valid(doc_id_str):
            logger.warning(f"Invalid doc_id format '{doc_id_str}' for mark_document_indexed.")
            return
        database = get_db_connection()
        if database is None: return
        documents_collection: Collection = database[MONGO_DOCUMENTS_COLLECTION]
        documents_collection.update_one(
            {"_id": ObjectId(doc_id_str)},
            {"$set": {"faiss_indexed": indexed, "indexed_at": datetime.now(timezone.utc) if indexed else None}}
        )
        logger.info(f"Document ID '{doc_id_str}' marked as FAISS indexed: {indexed}")
    except pymongo_errors.PyMongoError as e:
        logger.error(f"MongoDB error marking document '{doc_id_str}' as indexed: {e}", exc_info=True)

def create_chat_thread(user_id_str: str, title: str = "New Chat") -> str | None:
    """
    Creates a new chat thread for a user with an optional title.
    """
    try:
        if not ObjectId.is_valid(user_id_str):
            logger.warning(f"Invalid user_id format '{user_id_str}' for create_chat_thread.")
            return None
        database = get_db_connection()
        if database is None: return None
        chat_threads_collection: Collection = database[MONGO_CHAT_THREADS_COLLECTION]
        thread_id = str(uuid.uuid4())
        thread_doc = {
            "user_id": ObjectId(user_id_str), "thread_id": thread_id,
            "title": title, # Add title field
            "created_at": datetime.now(timezone.utc), "last_updated": datetime.now(timezone.utc),
            "summary": ""
        }
        result = chat_threads_collection.insert_one(thread_doc)
        if result.inserted_id:
            logger.info(f"New chat thread '{thread_id}' ('{title}') created for user '{user_id_str}'.")
            return thread_id
        else:
            logger.error(f"Failed to insert new chat thread for user '{user_id_str}'.")
            return None
    except pymongo_errors.PyMongoError as e:
        logger.error(f"MongoDB error creating chat thread for user '{user_id_str}': {e}", exc_info=True)
        return None

def get_user_threads(user_id_str: str) -> list[dict]:
    threads_list = []
    try:
        if not ObjectId.is_valid(user_id_str):
            logger.warning(f"Invalid user_id format '{user_id_str}' for get_user_threads.")
            return []
        database = get_db_connection()
        if database is None: return []
        chat_threads_collection: Collection = database[MONGO_CHAT_THREADS_COLLECTION]
        threads_cursor = chat_threads_collection.find({"user_id": ObjectId(user_id_str)}).sort("last_updated", -1)
        for thread in threads_cursor:
            threads_list.append({
                "thread_id": thread["thread_id"], "_id": str(thread["_id"]),
                "user_id": str(thread["user_id"]),
                "title": thread.get("title", "Untitled Chat"), # Include the title
                "created_at": thread.get("created_at").isoformat().replace('+00:00', 'Z') if isinstance(thread.get("created_at"), datetime) else None,
                "last_updated": thread.get("last_updated").isoformat().replace('+00:00', 'Z') if isinstance(thread.get("last_updated"), datetime) else None,
            })
        return threads_list
    except pymongo_errors.PyMongoError as e:
        logger.error(f"MongoDB error fetching threads for user '{user_id_str}': {e}", exc_info=True)
        return []

def get_thread_summary(user_id_str: str, thread_id_str: str) -> str | None:
    try:
        if not ObjectId.is_valid(user_id_str):
            logger.warning(f"Invalid user_id format '{user_id_str}' for get_thread_summary.")
            return None
        database = get_db_connection()
        if database is None: return None
        chat_threads_collection: Collection = database[MONGO_CHAT_THREADS_COLLECTION]
        thread = chat_threads_collection.find_one(
            {"user_id": ObjectId(user_id_str), "thread_id": thread_id_str}
        )
        if thread and "summary" in thread:
            return thread["summary"]
        return ""
    except pymongo_errors.PyMongoError as e:
        logger.error(f"MongoDB error fetching thread summary for user '{user_id_str}', thread '{thread_id_str}': {e}", exc_info=True)
        return None

def save_thread_summary(user_id_str: str, thread_id_str: str, summary: str):
    try:
        if not ObjectId.is_valid(user_id_str):
            logger.warning(f"Invalid user_id format '{user_id_str}' for save_thread_summary.")
            return
        database = get_db_connection()
        if database is None: return
        chat_threads_collection: Collection = database[MONGO_CHAT_THREADS_COLLECTION]
        result = chat_threads_collection.update_one(
            {"user_id": ObjectId(user_id_str), "thread_id": thread_id_str},
            {"$set": {"summary": summary, "last_updated": datetime.now(timezone.utc)}}
        )
        if result.matched_count == 0:
             logger.warning(f"Attempted to save summary for non-existent thread '{thread_id_str}' for user '{user_id_str}'.")
    except pymongo_errors.PyMongoError as e:
        logger.error(f"MongoDB error saving thread summary for user '{user_id_str}', thread '{thread_id_str}': {e}", exc_info=True)

def update_thread_title(user_id_str: str, thread_id_str: str, new_title: str):
    """
    Updates the title of an existing chat thread.
    """
    try:
        if not ObjectId.is_valid(user_id_str):
            logger.warning(f"Invalid user_id format '{user_id_str}' for update_thread_title.")
            return
        database = get_db_connection()
        if database is None: return
        chat_threads_collection: Collection = database[MONGO_CHAT_THREADS_COLLECTION]
        result = chat_threads_collection.update_one(
            {"user_id": ObjectId(user_id_str), "thread_id": thread_id_str},
            {"$set": {"title": new_title, "last_updated": datetime.now(timezone.utc)}}
        )
        if result.matched_count == 0:
            logger.warning(f"Attempted to update title for non-existent thread '{thread_id_str}' for user '{user_id_str}'.")
    except pymongo_errors.PyMongoError as e:
        logger.error(f"MongoDB error updating thread title for user '{user_id_str}', thread '{thread_id_str}': {e}", exc_info=True)


def save_message(user_id_str: str, thread_id_str: str, sender: str, message_text: str,
                 references: list | dict | None = None, cot_reasoning: str | None = None,
                 raw_prompt: str | None = None, raw_response: str | None = None, is_cot: bool = False) -> str | None:
    """
    Saves a chat message to the database, associating it with a thread.
    Includes fields for raw prompt/response and CoT flag for fine-tuning.
    """
    if not user_id_str or not thread_id_str or not sender or message_text is None:
        logger.error(f"Attempted to save message with invalid arguments: user_id={user_id_str}, thread={thread_id_str}, sender={sender}")
        return None
    if not ObjectId.is_valid(user_id_str):
        logger.error(f"Invalid user_id format '{user_id_str}' for save_message.")
        return None

    message_doc = {
        "user_id": ObjectId(user_id_str), "thread_id": thread_id_str,
        "sender": sender, "message_text": message_text,
        "timestamp": datetime.now(timezone.utc),
        "references_json": json.dumps(references) if references else None,
        "cot_reasoning": cot_reasoning,
        "raw_prompt": raw_prompt,       # New: Store the raw prompt for fine-tuning
        "raw_response": raw_response,   # New: Store the raw LLM response for fine-tuning
        "is_cot": is_cot                # New: Flag to indicate if CoT was used
    }
    try:
        database = get_db_connection()
        if database is None: return None
        thread_messages_collection: Collection = database[MONGO_THREAD_MESSAGES_COLLECTION]
        chat_threads_collection: Collection = database[MONGO_CHAT_THREADS_COLLECTION]
        result = thread_messages_collection.insert_one(message_doc)
        chat_threads_collection.update_one(
            {"user_id": ObjectId(user_id_str), "thread_id": thread_id_str},
            {"$set": {"last_updated": datetime.now(timezone.utc)}}
        )
        logger.info(f"Saved message '{result.inserted_id}' for user '{user_id_str}', thread '{thread_id_str}' (Sender: {sender}). Thread timestamp updated.")
        return str(result.inserted_id)
    except pymongo_errors.PyMongoError as e:
        logger.error(f"MongoDB error saving message or updating thread for user '{user_id_str}', thread '{thread_id_str}': {e}", exc_info=True)
        return None

def get_messages_by_thread(user_id_str: str, thread_id_str: str) -> list[dict] | None:
    messages_out = []
    try:
        if not ObjectId.is_valid(user_id_str):
            logger.warning(f"Invalid user_id format '{user_id_str}' for get_messages_by_thread.")
            return None
        database = get_db_connection()
        if database is None : return None
        thread_messages_collection: Collection = database[MONGO_THREAD_MESSAGES_COLLECTION]
        query = {"user_id": ObjectId(user_id_str), "thread_id": thread_id_str}
        raw_messages = thread_messages_collection.find(query).sort("timestamp", 1)
        for row in raw_messages:
            message_data = {
                "message_id": str(row["_id"]), "thread_id": row["thread_id"], # Changed session_id to thread_id
                "sender": row["sender"], "message_text": row["message_text"],
                "timestamp": row["timestamp"].isoformat().replace('+00:00', 'Z') if isinstance(row["timestamp"], datetime) else str(row["timestamp"]),
                "thinking": row.get("cot_reasoning"),
                "references": [],
                "raw_prompt": row.get("raw_prompt"),     # New: Include raw_prompt
                "raw_response": row.get("raw_response"), # New: Include raw_response
                "is_cot": row.get("is_cot", False)        # New: Include is_cot flag
            }
            try:
                ref_json = row.get('references_json')
                if ref_json:
                    parsed_data = json.loads(ref_json)
                    if isinstance(parsed_data, list):
                        message_data['references'] = parsed_data
                    elif isinstance(parsed_data, dict):
                        message_data['references'] = list(parsed_data.values())
                    else:
                         logger.warning(f"Unexpected type for references_json in message {message_data['message_id']}: {type(parsed_data).__name__}")
            except (json.JSONDecodeError, TypeError) as json_err:
                logger.warning(f"Could not parse references_json for message {message_data['message_id']}: {json_err}")
            except Exception as e:
                logger.error(f"Unexpected error parsing references for message {message_data['message_id']}: {e}", exc_info=True)
            messages_out.append(message_data)
        return messages_out
    except pymongo_errors.PyMongoError as e:
        logger.error(f"MongoDB error fetching history for user '{user_id_str}', thread '{thread_id_str}': {e}", exc_info=True)
        return None

# --- END OF FILE database.py ---