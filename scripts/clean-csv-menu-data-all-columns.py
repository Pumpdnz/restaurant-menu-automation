#!/usr/bin/env python3
"""
Script to clean CSV menu data by:
1. Removing the imageURL column (last column)
2. Cleaning unwanted phrases from ALL columns (not just tags)
"""

import csv
import sys
import re
from pathlib import Path

# List of phrases to remove from all columns
UNWANTED_PHRASES = [
    "Plus small",
    "Thumb up outline",
    "No. 1 most liked",
    "No. 2 most liked", 
    "No. 3 most liked",
]

# Regex patterns to remove (processed separately)
REGEX_PATTERNS = [
    r"\d+%",  # Matches percentages like "93%", "100%"
    r"\(\d+\)",  # Matches counts in parentheses like "(30)", "(8)"
]

def clean_field(field_value):
    """
    Clean a field by removing unwanted phrases while preserving legitimate content.
    
    Args:
        field_value: The original field value
        
    Returns:
        Cleaned field value with unwanted phrases removed
    """
    if not field_value:
        return field_value
    
    # Start with the original value
    cleaned = field_value
    
    # Special handling for fields that are ONLY the unwanted phrase
    if cleaned.strip() in UNWANTED_PHRASES:
        return ""
    
    # Remove each unwanted phrase (exact string matching)
    for phrase in UNWANTED_PHRASES:
        cleaned = cleaned.replace(phrase, "")
    
    # Remove regex patterns
    for pattern in REGEX_PATTERNS:
        cleaned = re.sub(pattern, "", cleaned)
    
    # Only clean up formatting if this looks like a tags field (has semicolons or specific patterns)
    if ';' in field_value or any(phrase in field_value for phrase in UNWANTED_PHRASES):
        # Clean up multiple semicolons and spaces
        cleaned = re.sub(r';\s*;', ';', cleaned)  # Remove duplicate semicolons
        cleaned = re.sub(r',\s*,', ',', cleaned)  # Remove duplicate commas
        cleaned = re.sub(r'\s+', ' ', cleaned)    # Normalize spaces
        
        # Remove leading/trailing whitespace and punctuation
        cleaned = cleaned.strip(' ;,')
        
        # Additional cleanup: remove any remaining parentheses with just spaces
        cleaned = re.sub(r'\(\s*\)', '', cleaned).strip()
    else:
        # For regular text fields, just trim whitespace
        cleaned = cleaned.strip()
    
    # If we removed everything, return empty string
    if not cleaned or cleaned.isspace():
        return ""
    
    return cleaned

def process_csv(input_file, output_file):
    """
    Process CSV file to remove imageURL column and clean all fields.
    
    Args:
        input_file: Path to input CSV file
        output_file: Path to output CSV file
    """
    rows_processed = 0
    fields_cleaned = 0
    
    with open(input_file, 'r', newline='', encoding='utf-8') as infile:
        reader = csv.reader(infile)
        rows = list(reader)
    
    if not rows:
        print("❌ Error: Input file is empty")
        return
    
    # Get header
    header = rows[0]
    
    # Write cleaned data
    with open(output_file, 'w', newline='', encoding='utf-8') as outfile:
        writer = csv.writer(outfile)
        
        for row_num, row in enumerate(rows):
            if row:  # Skip empty rows
                # Remove the last column (imageURL)
                cleaned_row = row[:-1] if len(row) > 0 else row
                
                # Clean all fields except header row
                if row_num > 0:
                    for col_idx in range(len(cleaned_row)):
                        original_value = cleaned_row[col_idx]
                        cleaned_value = clean_field(original_value)
                        
                        if original_value != cleaned_value:
                            fields_cleaned += 1
                            col_name = header[col_idx] if col_idx < len(header) else f"Column {col_idx + 1}"
                            
                            if original_value and cleaned_value:
                                print(f"  Row {row_num + 1}, {col_name}: '{original_value}' → '{cleaned_value}'")
                            elif original_value and not cleaned_value:
                                print(f"  Row {row_num + 1}, {col_name}: '{original_value}' → [removed completely]")
                        
                        cleaned_row[col_idx] = cleaned_value
                
                writer.writerow(cleaned_row)
                rows_processed += 1
    
    print(f"\n✓ Processed {rows_processed} rows")
    print(f"✓ Cleaned {fields_cleaned} fields across all columns")
    print(f"✓ Output saved to: {output_file}")

def main():
    if len(sys.argv) < 2:
        print("Usage: python clean-csv-menu-data-all-columns.py <input.csv> [output.csv]")
        print("\nThis script will:")
        print("  1. Remove the imageURL column (last column)")
        print("  2. Clean unwanted phrases from ALL columns")
        print("\nUnwanted phrases removed:")
        for phrase in UNWANTED_PHRASES:
            print(f"    - {phrase}")
        print("    - Percentage values (e.g., 93%, 100%)")
        print("    - Count values in parentheses (e.g., (30), (8))")
        print("\nExample:")
        print("  python clean-csv-menu-data-all-columns.py menu.csv menu_cleaned.csv")
        sys.exit(1)
    
    input_file = Path(sys.argv[1])
    
    if not input_file.exists():
        print(f"❌ Error: Input file '{input_file}' not found")
        sys.exit(1)
    
    # Generate output filename if not provided
    if len(sys.argv) >= 3:
        output_file = Path(sys.argv[2])
    else:
        # Add _no_images suffix before extension
        output_file = input_file.parent / f"{input_file.stem}_no_images{input_file.suffix}"
    
    print(f"Processing: {input_file}")
    print(f"Output to: {output_file}")
    print("\nCleaning all columns...")
    
    try:
        process_csv(input_file, output_file)
    except Exception as e:
        print(f"\n❌ Error processing file: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()