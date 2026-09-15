# -*- coding: utf-8 -*-
"""Convert the seeded rows in 06_seed_data.sql into assets/js/data.js.

Table and column names are kept exactly as the schema defines them, so the
shell speaks the same language as the database. Values that the triggers
derive (stock levels, paid_amount) are computed here, so the JS mirrors the
state the database would actually be in after seeding.
"""
import io
import json
import re
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

SQL = 'database/06_seed_data.sql'
OUT = 'assets/js/data.js'

# Columns that must never reach the browser. data.js is served to the client as
# plain text, so anything secret in it is public. The password hashes are only
# ever compared server side, and no screen reads them.
SECRET = {('users', 'password_hash')}

raw = io.open(SQL, encoding='utf-8').read()


def strip_comments(text):
    """Remove -- line comments that sit outside string literals."""
    out, i, n, in_str = [], 0, len(text), False
    while i < n:
        ch = text[i]
        if in_str:
            if ch == '\\' and i + 1 < n:
                out.append(text[i:i + 2]); i += 2; continue
            if ch == "'":
                in_str = False
            out.append(ch); i += 1; continue
        if ch == "'":
            in_str = True; out.append(ch); i += 1; continue
        if ch == '-' and text[i:i + 2] == '--':
            j = text.find('\n', i)
            i = n if j == -1 else j
            continue
        out.append(ch); i += 1
    return ''.join(out)


def split_tuples(body):
    """Split a VALUES body into top-level (...) groups."""
    rows, depth, cur, in_str = [], 0, [], False
    i, n = 0, len(body)
    while i < n:
        ch = body[i]
        if in_str:
            cur.append(ch)
            if ch == '\\' and i + 1 < n:
                cur.append(body[i + 1]); i += 2; continue
            if ch == "'":
                if body[i + 1:i + 2] == "'":
                    cur.append("'"); i += 2; continue
                in_str = False
            i += 1; continue
        if ch == "'":
            in_str = True; cur.append(ch); i += 1; continue
        if ch == '(':
            depth += 1
            if depth == 1:
                cur = []; i += 1; continue
        elif ch == ')':
            depth -= 1
            if depth == 0:
                rows.append(''.join(cur)); i += 1; continue
        if depth >= 1:
            cur.append(ch)
        i += 1
    return rows


def split_fields(row):
    """Split one tuple body on top-level commas."""
    out, cur, in_str, depth = [], [], False, 0
    i, n = 0, len(row)
    while i < n:
        ch = row[i]
        if in_str:
            cur.append(ch)
            if ch == "'":
                if row[i + 1:i + 2] == "'":
                    cur.append("'"); i += 2; continue
                in_str = False
            i += 1; continue
        if ch == "'":
            in_str = True; cur.append(ch); i += 1; continue
        if ch == '(':
            depth += 1
        elif ch == ')':
            depth -= 1
        if ch == ',' and depth == 0:
            out.append(''.join(cur).strip()); cur = []; i += 1; continue
        cur.append(ch); i += 1
    if cur:
        out.append(''.join(cur).strip())
    return out


def value(tok):
    t = tok.strip()
    if t.upper() == 'NULL':
        return None
    if t.startswith("'") and t.endswith("'"):
        return t[1:-1].replace("''", "'")
    if re.fullmatch(r'-?\d+', t):
        return int(t)
    if re.fullmatch(r'-?\d*\.\d+', t):
        return float(t)
    return t


clean = strip_comments(raw)
tables = {}
for m in re.finditer(r'INSERT\s+INTO\s+(\w+)\s*\(([^)]*)\)\s*VALUES(.*?);', clean, re.S | re.I):
    name = m.group(1)
    cols = [c.strip() for c in m.group(2).split(',')]
    rows = []
    for body in split_tuples(m.group(3)):
        vals = [value(v) for v in split_fields(body)]
        if len(vals) != len(cols):
            print('  !! %s: %d values for %d columns -> %r' % (name, len(vals), len(cols), vals[:4]))
            continue
        rows.append({c: v for c, v in zip(cols, vals) if (name, c) not in SECRET})
    tables[name] = rows
    held = [c for c in cols if (name, c) in SECRET]
    print('  %-24s %3d rows%s' % (name, len(rows),
          '   (withheld: %s)' % ', '.join(held) if held else ''))

# ---- apply what the triggers would do -------------------------------------
# payments -> reservations.paid_amount
paid = {}
for p in tables.get('payments', []):
    paid[p['reservation_id']] = round(paid.get(p['reservation_id'], 0) + float(p['amount']), 2)
for r in tables.get('reservations', []):
    r['paid_amount'] = paid.get(r['reservation_id'], 0.0)
    r['balance'] = round(float(r['total_amount']) - r['paid_amount'], 2)

# delivery_items raise stock, consumption lowers it
stock = {}
for d in tables.get('delivery_items', []):
    stock[d['item_id']] = round(stock.get(d['item_id'], 0) + float(d['quantity']), 3)
for c in tables.get('inventory_consumption', []):
    stock[c['item_id']] = round(stock.get(c['item_id'], 0) - float(c['quantity']), 3)
for it in tables.get('inventory_items', []):
    it['current_stock'] = stock.get(it['item_id'], 0.0)

neg = [i['item_code'] for i in tables.get('inventory_items', []) if i['current_stock'] < 0]
print('\n  negative stock after seed:', neg or 'none')

low = [i['item_code'] for i in tables.get('inventory_items', [])
       if i['current_stock'] <= float(i['reorder_level'])]
print('  at/below reorder level  :', low or 'none')

# ---- emit -----------------------------------------------------------------
ORDER = ['users', 'guests', 'room_types', 'rooms', 'reservations', 'payments',
         'suppliers', 'inventory_items', 'deliveries', 'delivery_items',
         'inventory_consumption', 'audit_logs']

parts = []
for t in ORDER:
    if t not in tables:
        continue
    rows = ',\n      '.join(json.dumps(r, ensure_ascii=False) for r in tables[t])
    parts.append('    %s: [\n      %s\n    ]' % (t, rows))

js = '''/* ============================================================================
 * data.js — records from the project database
 *
 * Generated from database/06_seed_data.sql. Table and column names match the
 * schema exactly (users, guests, room_types, rooms, reservations, payments,
 * suppliers, inventory_items, deliveries, delivery_items,
 * inventory_consumption, audit_logs), so the screens already speak the same
 * language as the database.
 *
 * Values the triggers derive are applied here as they would be in MariaDB:
 *   reservations.paid_amount  = sum of that reservation's payments
 *   inventory_items.current_stock = deliveries in, minus consumption out
 *
 * users.password_hash is deliberately absent: this file is plain text served
 * to the client, and no screen reads it.
 *
 * A browser cannot open a MariaDB connection, so this stands in for the live
 * database until the API layer exists. Regenerate with:
 *     python scripts/sql2js.py
 * ========================================================================== */
(function (App) {
  'use strict';

  App.DB = {
%s
  };
})(window.App = window.App || {});
''' % (',\n\n'.join(parts))

io.open(OUT, 'w', encoding='utf-8').write(js)
print('\nwrote %s (%d KB)' % (OUT, len(js) // 1024))
