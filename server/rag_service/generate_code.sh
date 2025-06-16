#!/bin/bash

# Output file
OUTPUT_FILE="code.txt"

# Clear previous output
> "$OUTPUT_FILE"

# Traverse files and directories, excluding __pycache__ and default.faiss
find . -type f \
    ! -path "*/__pycache__/*" \
    ! -name "*.pyc" \
    ! -name "default.faiss" \
    | while read file; do
        echo "============ $file ============" >> "$OUTPUT_FILE"
        cat "$file" >> "$OUTPUT_FILE"
        echo -e "\n\n" >> "$OUTPUT_FILE"
    done

echo "✅ Code has been saved to $OUTPUT_FILE"
