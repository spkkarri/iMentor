# download_model.py
from huggingface_hub import snapshot_download, HfFileSystem
import os
import time

# NEW SMALLER MODEL
MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
# For this model, 'main' revision is fine, or you can find a specific hash if you prefer
REVISION_HASH = "main" # Or a specific commit hash for this model

CACHE_DIR_BASE = os.path.join(os.path.expanduser("~"), ".cache", "huggingface")
HUB_CACHE_DIR = os.path.join(CACHE_DIR_BASE, "hub")
os.makedirs(HUB_CACHE_DIR, exist_ok=True)

print(f"Attempting to download snapshot for model: {MODEL_NAME} (Revision: {REVISION_HASH})")
print(f"Target cache directory for hub: {HUB_CACHE_DIR}")

print(f"\n--- Listing files on Hugging Face Hub for {MODEL_NAME} at revision {REVISION_HASH} ---")
fs = HfFileSystem()
try:
    repo_files = fs.ls(f"{MODEL_NAME}@{REVISION_HASH}", detail=False)
    print("Files found on Hub:")
    # We don't strictly need to check for config_sentence_transformers.json for this test,
    # just that the download itself works.
    for f_path in repo_files:
        print(f" - {f_path}")
except Exception as e:
    print(f"Error listing files from Hub: {e}")

print("\n--- Attempting snapshot download ---")
snapshot_path = None
try:
    # ENSURE CACHE IS CLEAN FOR THIS NEW MODEL TEST
    model_cache_path = os.path.join(HUB_CACHE_DIR, "models--" + MODEL_NAME.replace("/", "--"))
    if os.path.exists(model_cache_path):
        print(f"Deleting existing cache for {MODEL_NAME} at {model_cache_path}")
        import shutil
        shutil.rmtree(model_cache_path) # Delete the specific model's cache

    snapshot_path = snapshot_download(
        repo_id=MODEL_NAME,
        revision=REVISION_HASH,
        cache_dir=HUB_CACHE_DIR,
        force_download=True, # Force a fresh download for this test
    )
    print(f"Model snapshot download attempt finished. Nominal path: {snapshot_path}")
    
    time.sleep(1) # Shorter sleep for smaller model

    if snapshot_path and os.path.exists(snapshot_path):
        print(f"\n--- Contents of downloaded snapshot directory: {snapshot_path} ---")
        downloaded_files = os.listdir(snapshot_path)
        if not downloaded_files:
            print("The snapshot directory is EMPTY.")
        else:
            print("Files found locally:")
            for f_name in downloaded_files:
                print(f" - {f_name}")

        # Check for a key file, e.g., pytorch_model.bin or config.json
        # For all-MiniLM-L6-v2, 'pytorch_model.bin' is a key file.
        # config_sentence_transformers.json is also present.
        key_file_to_check = "config_sentence_transformers.json" # Or "pytorch_model.bin"
        key_file_path = os.path.join(snapshot_path, key_file_to_check)

        if os.path.exists(key_file_path) and os.path.isfile(key_file_path):
            print(f"\nSUCCESS: Key file '{key_file_path}' exists and is a file after download.")
            try:
                file_size = os.path.getsize(key_file_path)
                print(f"File size: {file_size} bytes.")
                if file_size == 0:
                    print("WARNING: File exists but is 0 bytes!")
            except Exception as e_size:
                print(f"Could not get file size: {e_size}")
        else:
            print(f"\nFAILURE: Key file '{key_file_path}' DOES NOT exist or is not a file after download.")
    else:
        print(f"\nFAILURE: Snapshot directory '{snapshot_path}' does not exist after download attempt.")

except Exception as e:
    print(f"\nAn error occurred during model download or processing: {e}")
    import traceback
    traceback.print_exc()