import os
import torch
from datasets import load_dataset
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    BitsAndBytesConfig,
    TrainingArguments,
)
from peft import LoraConfig, PeftModel
from trl import SFTTrainer
import logging
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# --- Configuration ---

# 1. Load Environment Variables and get Token
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
dotenv_path = os.path.join(project_root, '.env')
if not os.path.exists(dotenv_path):
    dotenv_path = os.path.join(os.getcwd(), '.env')
load_dotenv(dotenv_path=dotenv_path)

hf_token = os.getenv("HUGGING_FACE_HUB_TOKEN")

if not hf_token:
    raise ValueError("Hugging Face token not found. Please set HUGGING_FACE_HUB_TOKEN in your .env file.")

# 2. Model Configuration
base_model_name = "TinyLlama/TinyLlama-1.1B-Chat-v1.0"

# 3. Dataset path
dataset_path = os.path.join(os.path.dirname(__file__), 'formatted_dataset.jsonl')

# 4. Fine-tuned model output path
output_dir = os.path.join(os.path.dirname(__file__), 'results')


def main():
    # --- Step 1: Load the Dataset ---
    logging.info(f"Loading dataset from: {dataset_path}")
    if not os.path.exists(dataset_path):
        raise FileNotFoundError(f"Dataset file not found at {dataset_path}. Please run format_data.py first.")
    
    dataset = load_dataset('json', data_files=dataset_path, split="train")
    logging.info(f"Dataset loaded successfully. Number of training examples: {len(dataset)}")

    # --- Step 2: CPU Training - Skipping 4-bit quantization ---
    logging.info("Configuring for CPU training. Skipping BitsAndBytes.")

    # --- Step 3: Load Tokenizer ---
    logging.info(f"Loading tokenizer for model: {base_model_name}")
    tokenizer = AutoTokenizer.from_pretrained(
        base_model_name,
        token=hf_token,
        trust_remote_code=True
    )
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "right"
    logging.info("Tokenizer loaded successfully.")

    # --- Step 4: Load Base Model for CPU ---
    logging.info(f"Loading base model: {base_model_name}")
    model = AutoModelForCausalLM.from_pretrained(
        base_model_name,
        token=hf_token,
    )
    model.config.use_cache = False
    model.config.pretraining_tp = 1
    logging.info("Base model loaded successfully.")

    # --- Step 5: Configure LoRA (PEFT) ---
    logging.info("Configuring LoRA for PEFT...")
    lora_config = LoraConfig(
        lora_alpha=16,
        lora_dropout=0.1,
        r=64,
        bias="none",
        task_type="CAUSAL_LM",
    )
    logging.info("LoRA configured.")

    # --- Step 6: Configure Training Arguments ---
    logging.info("Setting training arguments...")
    training_arguments = TrainingArguments(
        output_dir=output_dir,
        num_train_epochs=1,
        per_device_train_batch_size=1,
        gradient_accumulation_steps=1,
        optim="adamw_torch",
        save_steps=50,
        logging_steps=1,
        learning_rate=2e-4,
        weight_decay=0.001,
        fp16=False,
        bf16=False,
        max_grad_norm=0.3,
        max_steps=-1,
        warmup_ratio=0.03,
        group_by_length=True,
        lr_scheduler_type="constant",
    )
    logging.info("Training arguments set.")

    # --- Step 7: Initialize the SFTTrainer ---
    logging.info("Initializing SFTTrainer...")

    # THIS IS THE CORRECTED BLOCK as per your request
    trainer = SFTTrainer(
        model=model,
        train_dataset=dataset,
        peft_config=lora_config,
        args=training_arguments,
        formatting_func=lambda example: example['text'], # Use formatting_func
        # REMOVED: dataset_text_field, tokenizer, max_seq_length
    )

    logging.info("SFTTrainer initialized.")

    # --- Step 8: Start Training ---
    logging.info("Starting model training...")
    trainer.train()
    logging.info("Training finished.")

    # --- Step 9: Save the Fine-Tuned Model Adapter ---
    logging.info(f"Saving fine-tuned LoRA adapter to {output_dir}")
    trainer.model.save_pretrained(output_dir)
    logging.info("Model saved successfully.")


if __name__ == '__main__':
    main()