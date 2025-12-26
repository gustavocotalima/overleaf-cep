#!/bin/bash
# Auto-install missing LaTeX packages during compilation
# This script wraps latexmk and automatically installs missing packages

MAX_RETRIES=15
retry=0

while [ $retry -lt $MAX_RETRIES ]; do
    # Run the actual command and capture output
    output=$("$@" 2>&1)
    exit_code=$?

    # Also read the LaTeX log file if it exists (latexmk writes errors there, not to stdout)
    # The log file is created by latexmk with -jobname=output, so it's output.log
    log_content=""
    if [ -f "output.log" ]; then
        log_content=$(cat output.log 2>/dev/null)
    fi
    # Combine both sources for pattern matching
    all_output="$output
$log_content"

    # Look for missing file patterns in LaTeX output
    # Pattern 1: File `xxx.sty' not found (packages, classes, definitions)
    # Note: LaTeX error ends with period, kpathsea doesn't - handle both
    # Extensions: sty (styles), cls (classes), def (definitions), fd (font defs),
    #             bst (bibtex styles), bbx (biblatex bib styles), cbx (biblatex cite styles)
    missing=$(echo "$all_output" | grep -oE "File \`[^']+\.(sty|cls|def|fd|bst|bbx|cbx)' not found\.?" | \
        sed "s/File \`//;s/' not found\.*//" | sort -u)

    # Pattern 2: biblatex style errors: "... file 'xxx.bbx' not found."
    # Note: Log line ends with period
    missing_biblatex=$(echo "$all_output" | grep -oE "\.\.\. file '[^']+\.(bbx|cbx)' not found\.?" | \
        sed "s/\.\.\. file '//;s/' not found\.*//" | sort -u)

    # Pattern 3: biblatex error: "! Package biblatex Error: Style 'xxx' not found."
    # Note: Starts with ! and ends with period in log. Extract style and append .bbx
    missing_biblatex_style=$(echo "$all_output" | grep -oE "Package biblatex Error: Style '[^']+' not found\.?" | \
        sed "s/Package biblatex Error: Style '//;s/' not found\.*//" | sort -u | sed 's/$/.bbx/')

    # Pattern 4: I can't find file `xxx' (fonts - from mktextfm errors)
    missing_fonts=$(echo "$all_output" | grep -oE "I can't find file \`[^']+'" | \
        sed "s/I can't find file \`//;s/'$//" | sort -u)

    # Combine missing files
    if [ -n "$missing_biblatex" ]; then
        missing="$missing $missing_biblatex"
    fi
    if [ -n "$missing_biblatex_style" ]; then
        missing="$missing $missing_biblatex_style"
    fi
    if [ -n "$missing_fonts" ]; then
        missing="$missing $missing_fonts"
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
