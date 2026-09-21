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

# Stock movement. trg_delivery_item_after_insert and trg_consumption_after_insert
# each do three things: move current_stock, and write one inventory_transactions
# row carrying the before/after snapshot. The delivery trigger also overwrites
# inventory_items.unit_cost with the price on the delivery line, so an item is
# valued at what it last cost, not at what it cost when the row was created.
# Replayed here in the same order the seed inserts them.
receiver = {d['delivery_id']: d.get('received_by') for d in tables.get('deliveries', [])}
stock, cost, restocked, ledger = {}, {}, {}, []
txn_id = 0


def move(item_id, kind, qty, unit_cost, ref_type, ref_id, reason, who, when, notes=None):
    global txn_id
    before = stock.get(item_id, 0.0)
    after = round(before + qty, 3)
    stock[item_id] = after
    txn_id += 1
    row = {'txn_id': txn_id, 'item_id': item_id, 'transaction_type': kind,
           'quantity': abs(qty), 'unit_cost': unit_cost,
           'total_cost': round(abs(qty) * float(unit_cost), 2),
           'stock_before': before, 'stock_after': after,
           'ref_type': ref_type, 'ref_id': ref_id, 'reason': reason,
           'performed_by': who, 'transaction_date': when}
    if notes is not None:
        row['notes'] = notes
    ledger.append(row)


for d in tables.get('delivery_items', []):
    move(d['item_id'], 'STOCK_IN', float(d['quantity']), d['unit_cost'],
         'DELIVERY', d['delivery_id'], 'SUPPLIER_DELIVERY',
         receiver.get(d['delivery_id']), None)
    cost[d['item_id']] = d['unit_cost']          # last delivery wins
    restocked[d['item_id']] = True

for c in tables.get('inventory_consumption', []):
    move(c['item_id'], 'STOCK_OUT', -float(c['quantity']),
         cost.get(c['item_id'], 0.0), 'CONSUMPTION', c.get('consumption_id'),
         c.get('purpose', 'MANUAL'), c.get('recorded_by'),
         c.get('consumption_date'), c.get('notes'))

for it in tables.get('inventory_items', []):
    i = it['item_id']
    it['current_stock'] = stock.get(i, 0.0)
    if i in cost:
        it['unit_cost'] = cost[i]

tables['inventory_transactions'] = ledger
print('  %-24s %3d rows   (written by the stock triggers)'
      % ('inventory_transactions', len(ledger)))

neg = [i['item_code'] for i in tables.get('inventory_items', []) if i['current_stock'] < 0]
print('\n  negative stock after seed:', neg or 'none')

low = [i['item_code'] for i in tables.get('inventory_items', [])
       if i['current_stock'] <= float(i['reorder_level'])]
print('  at/below reorder level  :', low or 'none')

# trg_payment_after_insert also writes a PAYMENT_RECORDED row into audit_logs,
# and the seed no longer hardcodes log_id, so AUTO_INCREMENT assigns it: these
# trigger rows are inserted first and take 1..n, then the seeded rows follow.
user_by_id = {u['user_id']: u for u in tables.get('users', [])}
ref_by_res = {r['reservation_id']: r.get('reference_number')
              for r in tables.get('reservations', [])}

trigger_audit = []
for pay in tables.get('payments', []):
    actor = user_by_id.get(pay.get('received_by'), {})
    trigger_audit.append({
        'user_id': pay.get('received_by'),
        'username_snapshot': actor.get('username', 'SYSTEM'),
        'role_snapshot': actor.get('role', 'SYSTEM'),
        'action_type': 'PAYMENT_RECORDED',
        'target_entity': 'PAYMENT',
        'target_id': pay['payment_id'],
        'description': 'Payment %s of PHP %s recorded for reservation %s via %s' % (
            pay['receipt_number'], pay['amount'],
            ref_by_res.get(pay['reservation_id'], '?'), pay['payment_method']),
        'logged_at': pay.get('payment_date'),
    })

rows = trigger_audit + tables.get('audit_logs', [])
for i, r in enumerate(rows, 1):
    r['log_id'] = i
    r.setdefault('ip_address', '127.0.0.1')
tables['audit_logs'] = rows
print('  %-24s %3d rows   (%d written by the payment trigger)'
      % ('audit_logs (final)', len(rows), len(trigger_audit)))

# ---- emit -----------------------------------------------------------------
ORDER = ['users', 'guests', 'room_types', 'rooms', 'reservations', 'payments',
         'suppliers', 'inventory_items', 'deliveries', 'delivery_items',
         'inventory_transactions', 'inventory_consumption', 'audit_logs']

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
 * inventory_transactions, inventory_consumption, audit_logs), so the screens
 * already speak the same language as the database.
 *
 * Values the triggers derive are applied here as they would be in MariaDB:
 *   reservations.paid_amount      = sum of that reservation's payments
 *   inventory_items.current_stock = deliveries in, minus consumption out
 *   inventory_items.unit_cost     = the price on the most recent delivery line
 *   inventory_transactions        = one ledger row per stock movement, with
 *                                   the before and after snapshot
 *   audit_logs                    = a PAYMENT_RECORDED row per payment, ahead
 *                                   of the seeded rows, with log_id assigned
 *                                   the way AUTO_INCREMENT would
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
