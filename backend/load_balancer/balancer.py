import requests
import os
import threading
import json
import logging

class LoadBalancer:
    def __init__(self, models):
        self.models = models  # List of model names
        self.model_status = {model: True for model in models}  # Track availability
        self.lock = threading.Lock()
        self.last_used_index = -1  # For round-robin

    def update_model_status(self, model, is_available):
        """Update the availability status of a model."""
        with self.lock:
            if model in self.model_status:
                self.model_status[model] = is_available

    def get_available_models(self):
        """Return a list of available models."""
        with self.lock:
            return [model for model, available in self.model_status.items() if available]

    def select_model(self):
        """Select the next available model using round-robin."""
        available_models = self.get_available_models()
        if not available_models:
            raise Exception("No available models to handle the request.")

        with self.lock:
            # Round-robin selection
            start = (self.last_used_index + 1) % len(self.models)
            for i in range(len(self.models)):
                idx = (start + i) % len(self.models)
                model = self.models[idx]
                if self.model_status.get(model, False):
                    self.last_used_index = idx
                    return model
            # If none available (should not happen), fallback
            return available_models[0]

    def get_prediction(self, prompt):
        """Send prompt to the selected model and return the response."""
        ollama_url = os.environ.get("OLLAMA_BASE_URL") or "http://localhost:11434"
        tried_models = set()
        for _ in range(len(self.models)):
            model = self.select_model()
            if model in tried_models:
                break
            tried_models.add(model)
            logging.info(f"[LoadBalancer] Selected model '{model}' for prompt: {prompt[:100]}...")
            try:
                response = requests.post(
                    f"{ollama_url}/api/generate",
                    json={"model": model, "prompt": prompt},
                    timeout=60,
                    stream=True
                )
                if response.ok:
                    full_reply = ""
                    for line in response.iter_lines(decode_unicode=True):
                        if not line:
                            continue
                        try:
                            chunk = json.loads(line)
                            full_reply += chunk.get("response", "")
                            if chunk.get("done", False):
                                break
                        except Exception:
                            continue
                    if full_reply.strip():
                        self.update_model_status(model, True)
                        return model, full_reply.strip()
                    else:
                        self.update_model_status(model, False)
                else:
                    self.update_model_status(model, False)
                    logging.error(f"[LoadBalancer] Model '{model}' failed: {response.text}")
            except Exception:
                self.update_model_status(model, False)
        return None, None

    def get_model_status(self):
        """Return the health status of all models."""
        with self.lock:
            return dict(self.model_status)

    def health_check(self):
        """Optional: Ping each model to update its status (can be run in a background thread)."""
        ollama_url = os.environ.get("OLLAMA_BASE_URL") or "http://localhost:11434"
        for model in self.models:
            try:
                # Try a lightweight request (e.g., /api/tags or /api/generate with a dummy prompt)
                response = requests.post(
                    f"{ollama_url}/api/generate",
                    json={"model": model, "prompt": "ping"},
                    timeout=10
                )
                self.update_model_status(model, response.ok)
            except Exception:
                self.update_model_status(model, False)