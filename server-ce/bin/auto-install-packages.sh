#!/bin/bash
# Auto-install missing LaTeX packages during compilation
# This script wraps latexmk and automatically installs missing packages

MAX_RETRIES=3
retry=0

while [ $retry -lt $MAX_RETRIES ]; do
    # Run the actual command and capture output
    output=$("$@" 2>&1)
    exit_code=$?

    # Look for missing file patterns in LaTeX output
    missing=$(echo "$output" | grep -oE "File \`[^']+\.(sty|cls|def|fd)' not found" | \
        sed "s/File \`//;s/' not found//" | sort -u)

    # If no missing files or command succeeded, we're done
    if [ -z "$missing" ] || [ $exit_code -eq 0 ]; then
        echo "$output"
        exit $exit_code
    fi

    # Try to install each missing file
    installed=0
    for file in $missing; do
        # Search for the package that provides this file
        pkg=$(tlmgr search --global --file "/$file" 2>/dev/null | head -1 | cut -d: -f1)
        if [ -n "$pkg" ]; then
            echo "[auto-install] Installing $pkg for $file..." >&2
            tlmgr install "$pkg" 2>&1 >&2
            installed=1
        fi
    done

    # If we couldn't install anything, give up
    [ $installed -eq 0 ] && { echo "$output"; exit $exit_code; }

    retry=$((retry + 1))
    echo "[auto-install] Retrying compilation (attempt $((retry + 1)))..." >&2
done

echo "$output"
exit $exit_code
