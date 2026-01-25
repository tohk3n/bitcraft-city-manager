#!/bin/bash
# Check for UTF-8 corruption patterns in source files
# Common pattern: UTF-8 bytes interpreted as Latin-1 produce â followed by garbage

# Navigate to project root (directory containing this script's parent)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

echo "Checking for UTF-8 corruption in $PROJECT_ROOT ..."

# Files to check
FILES=$(find . -type f \( -name "*.js" -o -name "*.css" -o -name "*.html" -o -name "*.md" \) \
    -not -path "./node_modules/*" \
    -not -path "./.git/*")

# Common corruption patterns:
# â€" (em dash), â€™ (apostrophe), â€œ â€ (quotes), âœ" (checkmark), − (minus)
PATTERNS='â€|â€™|â€œ|âœ|Ã©|Ã¨|Ã¼|Ã¶|Ã¤|Ã±|â—|â–|âˆ'

FOUND=0

for file in $FILES; do
    if grep -Pn "$PATTERNS" "$file" 2>/dev/null; then
        echo "  ^ Found in: $file"
        echo ""
        FOUND=1
    fi
done

if [ $FOUND -eq 0 ]; then
    echo "✓ No UTF-8 corruption detected"
    exit 0
else
    echo "✗ UTF-8 corruption found in files above"
    exit 1
fi
