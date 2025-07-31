"""
PyTorch-specific model manager with optimizations for LLM models.
"""

import torch
import logging
import os
import pickle
from typing import Any, Dict, Optional, Tuple
from pathlib import Path
from transformers import AutoModelForCausalLM, AutoTokenizer, AutoConfig
import gc

from .base_manager import BaseModelManager, ModelInfo, ModelConfig
from ..utils.unsloth_integration import unsloth_integration

logger = logging.getLogger(__name__)

class PyTorchModelManager(BaseModelManager):
    """
    PyTorch-specific model manager with optimizations for transformer models.
    """
    
    def __init__(self, config: ModelConfig):
        super().__init__(config)
        
        # PyTorch specific settings
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.torch_dtype = torch.float16 if torch.cuda.is_available() else torch.float32
        
        # Model tokenizers cache
        self.tokenizers: Dict[str, Any] = {}
        
        # Optimization settings
        self.use_torch_compile = hasattr(torch, 'compile')
        self.use_flash_attention = False  # Can be enabled if available
        
        logger.info(f"PyTorchModelManager initialized on device: {self.device}")
    
    def _load_model(self, model_info: ModelInfo) -> Any:
        """Load a PyTorch model from disk."""
        model_path = model_info.model_path
        
        try:
            # Check if it's a Unsloth model
            if self._is_unsloth_model(model_path):
                return self._load_unsloth_model(model_info)
            else:
                return self._load_standard_model(model_info)
                
        except Exception as e:
            logger.error(f"Failed to load model from {model_path}: {e}")
            raise
    
    def _is_unsloth_model(self, model_path: str) -> bool:
        """Check if the model was saved with Unsloth."""
        # Check for Unsloth-specific files or metadata
        unsloth_indicators = [
            "unsloth_config.json",
            "adapter_config.json",  # LoRA adapters
            "adapter_model.bin"
        ]
        
        for indicator in unsloth_indicators:
            if os.path.exists(os.path.join(model_path, indicator)):
                return True
        
        return False
    
    def _load_unsloth_model(self, model_info: ModelInfo) -> Any:
        """Load a model using Unsloth optimizations."""
        model_path = model_info.model_path
        
        try:
            # Load using Unsloth integration
            model, tokenizer = unsloth_integration.create_unsloth_model(
                model_name=model_path,
                max_seq_length=2048,
                dtype="float16" if torch.cuda.is_available() else "float32",
                load_in_4bit=True
            )
            
            # Optimize for inference
            model = unsloth_integration.optimize_for_inference(model)
            
            # Cache tokenizer
            self.tokenizers[model_info.model_id] = tokenizer
            
            logger.info(f"Loaded Unsloth model: {model_info.model_id}")
            return model
            
        except Exception as e:
            logger.warning(f"Failed to load with Unsloth, falling back to standard loading: {e}")
            return self._load_standard_model(model_info)
    
    def _load_standard_model(self, model_info: ModelInfo) -> Any:
        """Load a standard PyTorch model."""
        model_path = model_info.model_path
        
        # Load tokenizer first
        tokenizer = AutoTokenizer.from_pretrained(model_path)
        if tokenizer.pad_token is None:
            tokenizer.pad_token = tokenizer.eos_token
        
        # Cache tokenizer
        self.tokenizers[model_info.model_id] = tokenizer
        
        # Load model configuration
        config = AutoConfig.from_pretrained(model_path)
        
        # Configure model loading options
        model_kwargs = {
            "torch_dtype": self.torch_dtype,
            "device_map": "auto" if torch.cuda.is_available() else None,
            "trust_remote_code": True,
            "low_cpu_mem_usage": True
        }
        
        # Add quantization if on GPU
        if torch.cuda.is_available():
            try:
                from transformers import BitsAndBytesConfig
                
                quantization_config = BitsAndBytesConfig(
                    load_in_4bit=True,
                    bnb_4bit_compute_dtype=torch.float16,
                    bnb_4bit_use_double_quant=True,
                    bnb_4bit_quant_type="nf4"
                )
                model_kwargs["quantization_config"] = quantization_config
                
            except ImportError:
                logger.warning("BitsAndBytesConfig not available, loading without quantization")
        
        # Load the model
        model = AutoModelForCausalLM.from_pretrained(model_path, **model_kwargs)
        
        # Apply optimizations
        model = self._optimize_model(model, model_info)
        
        logger.info(f"Loaded standard model: {model_info.model_id}")
        return model
    
    def _optimize_model(self, model: Any, model_info: ModelInfo) -> Any:
        """Apply various optimizations to the model."""
        try:
            # Set to evaluation mode
            model.eval()
            
            # Enable gradient checkpointing for memory efficiency
            if hasattr(model, 'gradient_checkpointing_enable'):
                model.gradient_checkpointing_enable()
            
            # Compile model if available (PyTorch 2.0+)
            if self.use_torch_compile and hasattr(torch, 'compile'):
                try:
                    model = torch.compile(model, mode="reduce-overhead")
                    logger.info(f"Applied torch.compile to {model_info.model_id}")
                except Exception as e:
                    logger.warning(f"Failed to compile model {model_info.model_id}: {e}")
            
            # Move to appropriate device
            if not hasattr(model, 'device_map'):  # Only if not using device_map
                model = model.to(self.device)
            
            return model
            
        except Exception as e:
            logger.warning(f"Failed to optimize model {model_info.model_id}: {e}")
            return model
    
    def _unload_model(self, model_id: str, model: Any) -> bool:
        """Unload a PyTorch model from memory."""
        try:
            # Remove tokenizer from cache
            if model_id in self.tokenizers:
                del self.tokenizers[model_id]
            
            # Move model to CPU and delete
            if hasattr(model, 'cpu'):
                model.cpu()
            
            del model
            
            # Force garbage collection
            gc.collect()
            
            # Clear CUDA cache if available
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            
            return True
            
        except Exception as e:
            logger.error(f"Error unloading model {model_id}: {e}")
            return False
    
    def _get_model_memory_usage(self, model: Any) -> float:
        """Get memory usage of a PyTorch model in MB."""
        try:
            # Calculate model parameters memory
            param_memory = 0
            for param in model.parameters():
                param_memory += param.numel() * param.element_size()
            
            # Calculate buffer memory
            buffer_memory = 0
            for buffer in model.buffers():
                buffer_memory += buffer.numel() * buffer.element_size()
            
            total_memory = (param_memory + buffer_memory) / (1024 * 1024)  # Convert to MB
            
            return total_memory
            
        except Exception as e:
            logger.warning(f"Could not calculate model memory usage: {e}")
            return 0.0
    
    def get_tokenizer(self, model_id: str) -> Optional[Any]:
        """Get the tokenizer for a model."""
        return self.tokenizers.get(model_id)
    
    def generate_text(
        self,
        model_id: str,
        input_text: str,
        max_length: int = 100,
        temperature: float = 0.7,
        do_sample: bool = True,
        **kwargs
    ) -> Optional[str]:
        """Generate text using a loaded model."""
        model = self.get_model(model_id)
        tokenizer = self.get_tokenizer(model_id)
        
        if model is None or tokenizer is None:
            logger.error(f"Model or tokenizer not available for {model_id}")
            return None
        
        try:
            # Tokenize input
            inputs = tokenizer(
                input_text,
                return_tensors="pt",
                truncation=True,
                max_length=512
            ).to(self.device)
            
            # Generate
            with torch.no_grad():
                outputs = model.generate(
                    input_ids=inputs["input_ids"],
                    attention_mask=inputs["attention_mask"],
                    max_length=inputs["input_ids"].shape[1] + max_length,
                    temperature=temperature,
                    do_sample=do_sample,
                    pad_token_id=tokenizer.eos_token_id,
                    **kwargs
                )
            
            # Decode output
            input_length = inputs["input_ids"].shape[1]
            generated_ids = outputs[0][input_length:]
            generated_text = tokenizer.decode(generated_ids, skip_special_tokens=True)
            
            # Update usage statistics
            if model_id in self.models:
                self.models[model_id].last_used = time.time()
                self.models[model_id].usage_count += 1
            
            return generated_text.strip()
            
        except Exception as e:
            logger.error(f"Error generating text with {model_id}: {e}")
            return None
    
    def benchmark_model(self, model_id: str, num_runs: int = 10) -> Dict[str, float]:
        """Benchmark a model's inference performance."""
        model = self.get_model(model_id)
        tokenizer = self.get_tokenizer(model_id)
        
        if model is None or tokenizer is None:
            return {"error": "Model or tokenizer not available"}
        
        test_input = "What is the meaning of life?"
        times = []
        
        # Warm up
        for _ in range(3):
            self.generate_text(model_id, test_input, max_length=50)
        
        # Benchmark
        import time
        for _ in range(num_runs):
            start_time = time.time()
            self.generate_text(model_id, test_input, max_length=50)
            end_time = time.time()
            times.append(end_time - start_time)
        
        return {
            "avg_inference_time": sum(times) / len(times),
            "min_inference_time": min(times),
            "max_inference_time": max(times),
            "throughput_per_sec": 1.0 / (sum(times) / len(times))
        }
    
    def save_model_cache(self, model_id: str) -> bool:
        """Save model to cache for faster loading."""
        if not self.config.enable_model_caching:
            return False
        
        model = self.loaded_models.get(model_id)
        if model is None:
            return False
        
        try:
            cache_path = os.path.join(self.config.cache_directory, f"{model_id}.cache")
            
            # Save model state dict
            torch.save({
                'model_state_dict': model.state_dict(),
                'model_config': model.config.to_dict() if hasattr(model, 'config') else {},
                'model_id': model_id
            }, cache_path)
            
            logger.info(f"Saved model cache for {model_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to save model cache for {model_id}: {e}")
            return False
    
    def load_model_cache(self, model_id: str) -> Optional[Any]:
        """Load model from cache."""
        if not self.config.enable_model_caching:
            return None
        
        try:
            cache_path = os.path.join(self.config.cache_directory, f"{model_id}.cache")
            
            if not os.path.exists(cache_path):
                return None
            
            # Load cached model
            cached_data = torch.load(cache_path, map_location=self.device)
            
            # This is a simplified implementation
            # In practice, you'd need to reconstruct the model architecture
            logger.info(f"Loaded model cache for {model_id}")
            return cached_data
            
        except Exception as e:
            logger.error(f"Failed to load model cache for {model_id}: {e}")
            return None
    
    def get_gpu_memory_info(self) -> Dict[str, float]:
        """Get GPU memory information."""
        if not torch.cuda.is_available():
            return {"error": "CUDA not available"}
        
        try:
            allocated = torch.cuda.memory_allocated() / 1024**3  # GB
            reserved = torch.cuda.memory_reserved() / 1024**3   # GB
            max_allocated = torch.cuda.max_memory_allocated() / 1024**3  # GB
            
            device_props = torch.cuda.get_device_properties(0)
            total_memory = device_props.total_memory / 1024**3  # GB
            
            return {
                "allocated_gb": allocated,
                "reserved_gb": reserved,
                "max_allocated_gb": max_allocated,
                "total_gb": total_memory,
                "utilization_percent": (allocated / total_memory) * 100
            }
            
        except Exception as e:
            return {"error": str(e)}
