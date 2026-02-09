/**
 * Split a SQL text into individual statements on semicolons,
 * respecting single-quoted strings, double-quoted identifiers,
 * single-line comments (--), and block comments.
 *
 * Returns non-empty trimmed statements (without trailing semicolons).
 */
export default function splitStatements(sql: string): string[] {
    const statements: string[] = []
    let current = ''
    let i = 0
    const len = sql.length

    while (i < len) {
        const ch = sql[i]

        // Single-line comment: skip to end of line
        if (ch === '-' && i + 1 < len && sql[i + 1] === '-') {
            const eol = sql.indexOf('\n', i)
            if (eol === -1) {
                current += sql.substring(i)
                i = len
            } else {
                current += sql.substring(i, eol + 1)
                i = eol + 1
            }
            continue
        }

        // Block comment: skip to closing */
        if (ch === '/' && i + 1 < len && sql[i + 1] === '*') {
            const close = sql.indexOf('*/', i + 2)
            if (close === -1) {
                current += sql.substring(i)
                i = len
            } else {
                current += sql.substring(i, close + 2)
                i = close + 2
            }
            continue
        }

        // Quoted string or identifier: skip to matching close quote
        if (ch === "'" || ch === '"') {
            const quote = ch
            let j = i + 1
            while (j < len) {
                if (sql[j] === quote) {
                    // Escaped quote (doubled): skip
                    if (j + 1 < len && sql[j + 1] === quote) {
                        j += 2
                    } else {
                        j++
                        break
                    }
                } else {
                    j++
                }
            }
            current += sql.substring(i, j)
            i = j
            continue
        }

        // Statement separator
        if (ch === ';') {
            const trimmed = current.trim()
            if (trimmed) {
                statements.push(trimmed)
            }
            current = ''
            i++
            continue
        }

        current += ch
        i++
    }

    // Remaining text after last semicolon (or the only statement without semicolons)
    const trimmed = current.trim()
    if (trimmed) {
        statements.push(trimmed)
    }

    return statements
}
