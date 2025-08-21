# server/ai_core_service/podcast_service.py

import os
import uuid
import shutil
import time
from pydub import AudioSegment
import eyed3
from gtts import gTTS
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from .faiss_handler import get_embedding_model, get_podcast_index_path, create_podcast_index
# Import BOTH Q&A and the new script generation functions
from .llm_handler import get_podcast_qa_answer, generate_podcast_script

_SERVICE_DIR = os.path.dirname(os.path.abspath(__file__))
PODCAST_OUTPUT_DIR = os.path.join(_SERVICE_DIR, "generated_podcasts/")
TEMP_DIR = os.path.join(PODCAST_OUTPUT_DIR, "temp_audio/")

def generate_speech_segment_gtts(text, output_path, gender='male'):
    try:
        # Use different top-level domains for different sounding voices
        tld = 'com.au' if gender == 'male' else 'co.uk'
        tts = gTTS(text=text, lang='en', tld=tld, slow=False)
        tts.save(output_path)
        return True
    except Exception as e:
        print(f"Error generating speech segment with gTTS: {e}")
        return False

# This is the main function being upgraded
def create_podcast_from_text(text: str, podcast_id: str, title: str = "AI Generated Podcast", api_keys: dict = {}):
    print(f"--- Starting ADVANCED podcast generation for ID: {podcast_id} ---")
    start_time = time.time()
    
    temp_podcast_dir = os.path.join(TEMP_DIR, podcast_id)
    os.makedirs(PODCAST_OUTPUT_DIR, exist_ok=True)
    os.makedirs(temp_podcast_dir, exist_ok=True)

    # STEP 1: Generate Conversational Script (or fallback to original text)
    script_text = generate_podcast_script(text, api_keys)
    original_text_for_rag = text 

    # =================== THIS IS THE ROBUST LOGIC FIX ===================
    is_script_formatted = "alex:" in script_text.lower() or "ben:" in script_text.lower()
    
    segment_paths = []

    if is_script_formatted:
        # --- PATH A: Process a formatted, two-voice script ---
        print("Processing formatted two-voice script...")
        script_lines = [line.strip() for line in script_text.split('\n') if line.strip()]
        for i, line in enumerate(script_lines):
            segment_path = os.path.join(temp_podcast_dir, f"segment_{i}.mp3")
            dialogue, gender = "", "male"
            if line.lower().startswith('alex:'):
                gender, dialogue = 'male', line[5:].strip()
            elif line.lower().startswith('ben:'):
                gender, dialogue = 'female', line[4:].strip()
            
            if dialogue:
                print(f"  - Segment {i+1}/{len(script_lines)} ({gender}): '{dialogue[:40]}...'")
                if generate_speech_segment_gtts(dialogue, segment_path, gender):
                    segment_paths.append(segment_path)
    else:
        # --- PATH B: Process plain text with alternating voices (Fallback) ---
        print("Processing plain text with alternating voices...")
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=100)
        chunks = text_splitter.split_text(script_text) # script_text is the original text here
        for i, chunk in enumerate(chunks):
            segment_path = os.path.join(temp_podcast_dir, f"segment_{i}.mp3")
            gender = 'female' if i % 2 != 0 else 'male'
            print(f"  - Segment {i+1}/{len(chunks)} ({gender}): '{chunk[:40]}...'")
            if generate_speech_segment_gtts(chunk, segment_path, gender):
                segment_paths.append(segment_path)
    # ====================================================================

    if not segment_paths:
        shutil.rmtree(temp_podcast_dir)
        raise RuntimeError("Failed to generate any audio segments from the provided text.")
    
    print("Concatenating audio segments...")
    combined_audio = AudioSegment.empty()
    for path in segment_paths:
        try:
            segment_audio = AudioSegment.from_mp3(path)
            combined_audio += segment_audio
        except Exception as e:
            print(f"Warning: Could not process segment {path}. Skipping. Error: {e}")

    if len(combined_audio) == 0:
        shutil.rmtree(temp_podcast_dir)
        raise RuntimeError("Failed to create a valid combined audio file.")

    final_audio_path = os.path.join(PODCAST_OUTPUT_DIR, f"{podcast_id}.mp3")
    combined_audio.export(final_audio_path, format="mp3")
    
    try:
        audio_file = eyed3.load(final_audio_path)
        if audio_file and audio_file.tag:
            audio_file.tag.artist = "Alex & Ben (AI)"
            audio_file.tag.album = "FusedChat Podcasts"
            audio_file.tag.title = title
            audio_file.tag.save()
    except Exception: pass

    # --- Create RAG Index from the ORIGINAL Text ---
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=150)
    chunks_for_rag = text_splitter.split_text(original_text_for_rag)
    print(f"Creating RAG index from {len(chunks_for_rag)} chunks of original source text...")
    create_podcast_index(podcast_id, chunks_for_rag)
    
    print("Cleaning up temporary files...")
    shutil.rmtree(temp_podcast_dir)

    end_time = time.time()
    audio_length_seconds = len(combined_audio) / 1000
    print(f"--- Podcast generation complete in {end_time - start_time:.2f} seconds ---")
    print(f"  - Final Audio Length: {audio_length_seconds:.2f} seconds")
    return final_audio_path


# The Q&A function remains unchanged and will work perfectly.
def answer_podcast_question(podcast_id: str, question: str, api_keys: dict):
    """
    Answers a user's question by retrieving context from a podcast's vector store
    and querying the LLM fallback chain.
    """
    print(f"Answering question for podcast {podcast_id}: '{question}'")
    
    index_path = get_podcast_index_path(podcast_id)
    if not os.path.exists(index_path):
        return "Error: Could not find the data for this podcast. Please try generating it again."
    
    try:
        embedder = get_embedding_model()
        if not embedder:
            raise RuntimeError("Embedding model could not be initialized.")
        
        print(f"Loading vector store from: {index_path}")
        vector_store = FAISS.load_local(
            folder_path=index_path,
            embeddings=embedder,
            allow_dangerous_deserialization=True
        )
    except Exception as e:
        print(f"Error loading vector store for podcast {podcast_id}: {e}")
        return "Error: Could not load the data for this podcast."

    print("Performing vector search for relevant context...")
    retrieved_docs = vector_store.similarity_search(question, k=4)
    
    if not retrieved_docs:
        return "Could not find any relevant information in the podcast to answer this question."

    context = "\n\n---\n\n".join([doc.page_content for doc in retrieved_docs])
    
    print("Sending context and question to LLM handler...")
    answer = get_podcast_qa_answer(
        context=context,
        question=question,
        api_keys=api_keys
    )
    
    return answer