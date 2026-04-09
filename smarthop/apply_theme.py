import os
import re

directories = [
    r"c:\Users\Jaineel\OneDrive\Desktop\Smarthop_C_S12\smarthop\app",
    r"c:\Users\Jaineel\OneDrive\Desktop\Smarthop_C_S12\smarthop\components"
]

replacements = {
    # Core Primary Identity (Blue -> Teal)
    "bg-blue-600": "bg-teal-700",
    "text-blue-600": "text-teal-700",
    "border-blue-600": "border-teal-700",
    "ring-blue-600": "ring-teal-700",
    
    "bg-blue-500": "bg-teal-600",
    "text-blue-500": "text-teal-600",
    "border-blue-500": "border-teal-600",
    
    "bg-blue-100": "bg-teal-100",
    "text-blue-100": "text-teal-100",
    "border-blue-100": "border-teal-100",
    "ring-blue-100": "ring-teal-100",
    
    "bg-blue-50": "bg-teal-50",
    "text-blue-50": "text-teal-50",
    "border-blue-50": "border-teal-50",
    
    "bg-blue-400": "bg-teal-500",
    "text-blue-400": "text-teal-500",
    
    "bg-blue-200": "bg-teal-200",
    "text-blue-200": "text-teal-200",
    
    "bg-blue-300": "bg-teal-300",
    "text-blue-300": "text-teal-300",
    
    # We leave blue-800 and blue-900 untouched or handle them separately, 
    # since Deep Blue is #1E3A8A (blue-900). 
    
    # Let's adjust slate to be explicit for the background/text requested
    # Background: #F8FAFC (slate-50)
    # Text: #0F172A (slate-950)
    # Generally, the app is already using slate-50 and slate-900/950 for backgrounds.
}

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    new_content = content
    for old, new in replacements.items():
        # Using simple string replace since we're just matching entire class names
        new_content = new_content.replace(old, new)

    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated {filepath}")

for directory in directories:
    for root, _, files in os.walk(directory):
        for file in files:
            if file.endswith(('.tsx', '.ts')):
                process_file(os.path.join(root, file))
