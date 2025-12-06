#!/bin/bash
# Auto-install missing LaTeX packages during compilation
# This script wraps latexmk and automatically installs missing packages

MAX_RETRIES=15
retry=0

while [ $retry -lt $MAX_RETRIES ]; do
    # Run the actual command and capture output
    output=$("$@" 2>&1)
    exit_code=$?

    # Look for missing file patterns in LaTeX output
    # Pattern 1: File `xxx.sty' not found (packages, classes, definitions)
    missing=$(echo "$output" | grep -oE "File \`[^']+\.(sty|cls|def|fd|bst)' not found" | \
        sed "s/File \`//;s/' not found//" | sort -u)

    # Pattern 2: I can't find file `xxx' (fonts - from mktextfm errors)
    missing_fonts=$(echo "$output" | grep -oE "I can't find file \`[^']+'" | \
        sed "s/I can't find file \`//;s/'$//" | sort -u)

    # Pattern 3: BibTeX "I couldn't open style file xxx.bst"
    missing_bst=$(echo "$output" | grep -oE "I couldn't open style file [^.]+\.bst" | \
        sed "s/I couldn't open style file //" | sort -u)

    # Pattern 4: BibTeX "I couldn't open database file xxx.bib" (unlikely but possible)
    # Pattern 5: LaTeX "! LaTeX Error: File `xxx.sty' not found"
    missing_latex_error=$(echo "$output" | grep -oE "! LaTeX Error: File \`[^']+\.(sty|cls|def|fd)' not found" | \
        sed "s/! LaTeX Error: File \`//;s/' not found//" | sort -u)

    # Combine missing files
    if [ -n "$missing_fonts" ]; then
        missing="$missing $missing_fonts"
    fi
    if [ -n "$missing_bst" ]; then
        missing="$missing $missing_bst"
    fi
    if [ -n "$missing_latex_error" ]; then
        missing="$missing $missing_latex_error"
    fi

    # If no missing files or command succeeded, we're done
    if [ -z "$missing" ] || [ $exit_code -eq 0 ]; then
        echo "$output"
        exit $exit_code
    fi

    # Try to install each missing file
    installed=0
    for file in $missing; do
        # Search for the package that provides this file (skip tlmgr info lines)
        pkg=$(tlmgr search --global --file "/$file" 2>/dev/null | grep -v "^tlmgr:" | head -1 | cut -d: -f1)
        if [ -n "$pkg" ]; then
            echo "[auto-install] Installing $pkg for $file..." >&2
            tlmgr install "$pkg" 2>&1 >&2
            installed=1
        fi
    done

    # If we installed anything, update the TeX file database
    if [ $installed -eq 1 ]; then
        echo "[auto-install] Updating TeX file database..." >&2
        mktexlsr 2>&1 >&2
    fi

    # If we couldn't install anything, give up
    [ $installed -eq 0 ] && { echo "$output"; exit $exit_code; }

    retry=$((retry + 1))
    echo "[auto-install] Retrying compilation (attempt $((retry + 1)))..." >&2
done

echo "$output"
exit $exit_code
