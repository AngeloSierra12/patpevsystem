# -*- coding: utf-8 -*-
"""Wireframe document for the PATVEP Hostel & Canteen System.

Low fidelity on purpose: grey blocks, labels and annotations. A wireframe
settles layout, hierarchy and flow. Colour, type and spacing are settled
separately in the build.
"""
import os
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor

W, H = landscape(A4)            # 841.89 x 595.28

INK = HexColor('#1b1618')
MUT = HexColor('#6b6365')
FAINT = HexColor('#9a9294')
LINE = HexColor('#b9b1b2')
FILL = HexColor('#e8e4e4')
FILL2 = HexColor('#f4f1f1')
FILL3 = HexColor('#d8d2d3')
RED = HexColor('#ae0404')
WHITE = HexColor('#ffffff')

M = 34                          # page margin


# --------------------------------------------------------------- primitives
def box(c, x, y, w, h, label=None, fill=FILL, stroke=LINE, dash=False,
        size=7, align='left', bold=False):
    outline = 1 if stroke is not None else 0
    if outline:
        c.setStrokeColor(stroke)
    c.setLineWidth(0.7)
    c.setDash(3, 2) if dash else c.setDash()
    if fill is not None:
        c.setFillColor(fill)
        c.rect(x, y, w, h, stroke=outline, fill=1)
    else:
        c.rect(x, y, w, h, stroke=outline, fill=0)
    c.setDash()
    if label:
        c.setFillColor(MUT)
        c.setFont('Helvetica-Bold' if bold else 'Helvetica', size)
        if align == 'center':
            c.drawCentredString(x + w / 2.0, y + h / 2.0 - size * 0.35, label)
        else:
            c.drawString(x + 5, y + h / 2.0 - size * 0.35, label)


def text(c, x, y, s, size=7, color=MUT, bold=False, align='left'):
    c.setFillColor(color)
    c.setFont('Helvetica-Bold' if bold else 'Helvetica', size)
    if align == 'center':
        c.drawCentredString(x, y, s)
    elif align == 'right':
        c.drawRightString(x, y, s)
    else:
        c.drawString(x, y, s)


def lines(c, x, y, w, n, gap=6, h=2.2):
    """Grey bars standing in for text."""
    c.setFillColor(FILL3)
    for i in range(n):
        lw = w * 0.62 if i == n - 1 else w
        c.rect(x, y - i * gap, lw, h, stroke=0, fill=1)


def marker(c, x, y, n):
    """Numbered dot tying the drawing to the notes underneath."""
    c.setFillColor(RED)
    c.circle(x, y, 6.5, stroke=0, fill=1)
    c.setFillColor(WHITE)
    c.setFont('Helvetica-Bold', 7)
    c.drawCentredString(x, y - 2.5, str(n))


def wrap(c, s, x, y, width, size=8, leading=10, color=MUT, bold=False):
    """Very small word wrapper; returns the y after the last line."""
    font = 'Helvetica-Bold' if bold else 'Helvetica'
    c.setFont(font, size)
    c.setFillColor(color)
    words, line = s.split(), ''
    for wd in words:
        trial = (line + ' ' + wd).strip()
        if c.stringWidth(trial, font, size) <= width:
            line = trial
        else:
            c.drawString(x, y, line)
            y -= leading
            line = wd
    if line:
        c.drawString(x, y, line)
        y -= leading
    return y


# ------------------------------------------------------------- page chrome
def page_header(c, module, wbs, owner, built):
    text(c, M, H - M - 4, module, size=15, color=INK, bold=True)
    text(c, M, H - M - 18, 'WBS ' + wbs + '   |   Wireframe by ' + owner,
         size=8, color=MUT)
    tag = 'BUILT IN THE UI SHELL' if built else 'WIREFRAME ONLY'
    tw = c.stringWidth(tag, 'Helvetica-Bold', 7) + 12
    c.setFillColor(FILL2)
    c.setStrokeColor(LINE)
    c.rect(W - M - tw, H - M - 12, tw, 14, stroke=1, fill=1)
    text(c, W - M - tw / 2.0, H - M - 8, tag, size=7, color=MUT, bold=True,
         align='center')
    c.setStrokeColor(LINE)
    c.setLineWidth(0.7)
    c.line(M, H - M - 26, W - M, H - M - 26)


def page_footer(c, page_no, total):
    c.setStrokeColor(HexColor('#ddd7d8'))
    c.setLineWidth(0.6)
    c.line(M, 30, W - M, 30)
    text(c, M, 20, 'IGP PATVEP Hostel and University Canteen  |  Wireframe document',
         size=7, color=FAINT)
    text(c, W - M, 20, 'Page %d of %d' % (page_no, total), size=7, color=FAINT,
         align='right')


def notes(c, items, top=178):
    """Numbered annotations under the frame, two columns."""
    text(c, M, top + 16, 'NOTES', size=7.5, color=INK, bold=True)
    colw = (W - 2 * M - 26) / 2.0
    for i, (head, body) in enumerate(items):
        col, row = i % 2, i // 2
        x = M + col * (colw + 26)
        y = top - row * 38
        marker(c, x + 6, y - 2, i + 1)
        text(c, x + 18, y - 5, head, size=8, color=INK, bold=True)
        wrap(c, body, x + 18, y - 16, colw - 20, size=7.5, leading=9)


# ------------------------------------------------------------ shared chrome
FX, FY, FW, FH = M, 210, W - 2 * M, 300      # frame rectangle

# One vertical grid shared by every screen, so nothing overflows the frame.
TITLE_Y = 472
ROW1_Y, ROW1_H = 430, 34
ROW2_Y, ROW2_H = 330, 94
ROW3_Y, ROW3_H = 232, 92
BOTTOM = 232


def app_chrome(c, section, active_row=0):
    """Sidebar plus top bar, shared by every screen.

    The bar names the SECTION, not the page. The page has its own heading just
    below, and printing the name in both places said the same word twice.
    """
    box(c, FX, FY, FW, FH, None, fill=WHITE, stroke=LINE)

    # sidebar
    box(c, FX, FY, 108, FH, None, fill=FILL, stroke=LINE)
    box(c, FX + 8, FY + FH - 30, 20, 20, None, fill=FILL3)
    text(c, FX + 33, FY + FH - 23, 'BPSU seal', size=6.5)

    nav = ['Dashboard', 'Hotel Reservation', 'Canteen Inventory',
           'Scheduling & Calendar', 'User Management', 'Reports', 'Audit Trail']
    base = FY + FH - 62
    text(c, FX + 8, base + 15, 'OPERATIONS', size=5.5, bold=True, color=FAINT)
    for i, label in enumerate(nav):
        gap = 20 if i >= 4 else 0
        yy = base - i * 17 - gap
        if i == 4:
            text(c, FX + 8, yy + 16, 'ADMINISTRATION', size=5.5, bold=True, color=FAINT)
        on = (i == active_row)
        box(c, FX + 6, yy, 96, 13, label,
            fill=FILL3 if on else FILL2, size=6, bold=on)

    # top bar: section on the left, account on the right
    box(c, FX + 108, FY + FH - 26, FW - 108, 26, None, fill=FILL2, stroke=LINE)
    text(c, FX + 118, FY + FH - 16, section.upper(), size=6.5, color=MUT, bold=True)
    box(c, FX + FW - 96, FY + FH - 21, 86, 16, 'signed-in user', size=6,
        fill=WHITE, align='center')

    # status strip
    box(c, FX + 108, FY, FW - 108, 14, None, fill=FILL2, stroke=LINE)
    text(c, FX + 116, FY + 5, 'UI shell  |  records from the project database',
         size=6)
    text(c, FX + FW - 12, FY + 5, 'role', size=6, align='right')


def content_x():
    """Left edge and width of the region inside the chrome."""
    return FX + 118, FW - 108 - 20


def head(c, x, y, label, n=None):
    """Panel heading. The marker sits before the text, never on top of it."""
    if n is not None:
        marker(c, x + 6, y + 2, n)
        x += 18
    text(c, x, y, label, size=6, bold=True, color=INK)


# ------------------------------------------------------------- 1. Dashboard
def draw_dashboard(c):
    app_chrome(c, 'Operations', active_row=0)
    px, cw = content_x()

    text(c, px, TITLE_Y, 'Dashboard', size=9, color=INK, bold=True)
    box(c, px + cw - 60, TITLE_Y - 5, 60, 15, 'Refresh', size=6,
        fill=WHITE, align='center')

    # metric strip
    box(c, px, ROW1_Y, cw, ROW1_H, None, fill=WHITE)
    labels = ['OCCUPANCY', 'ROOMS FREE', 'ARRIVALS', 'LOW STOCK']
    for i in range(4):
        cx = px + i * (cw / 4.0)
        if i:
            c.setStrokeColor(HexColor('#e4dedf'))
            c.line(cx, ROW1_Y + 4, cx, ROW1_Y + ROW1_H - 4)
        text(c, cx + (26 if i == 0 else 9), ROW1_Y + ROW1_H - 11, labels[i],
             size=5.5, bold=True, color=FAINT)
        box(c, cx + (26 if i == 0 else 9), ROW1_Y + 7, 30, 12, None, fill=FILL3)
    marker(c, px + 12, ROW1_Y + ROW1_H - 9, 1)

    lw = cw - 156
    rx = px + lw + 12
    rw = 144

    # occupancy
    box(c, px, ROW2_Y, lw, ROW2_H, None, fill=WHITE)
    head(c, px + 4, ROW2_Y + ROW2_H - 12, 'ROOM OCCUPANCY, NEXT 7 DAYS', 2)
    for b in range(7):
        bh = [40, 48, 33, 43, 26, 35, 22][b]
        box(c, px + 16 + b * ((lw - 34) / 7.0), ROW2_Y + 10, 22, bh, None, fill=FILL3)

    # stock
    box(c, px, ROW3_Y, lw, ROW3_H, None, fill=WHITE)
    head(c, px + 4, ROW3_Y + ROW3_H - 12, 'CANTEEN STOCK LEVELS', 3)
    for r in range(4):
        yy = ROW3_Y + ROW3_H - 28 - r * 15
        lines(c, px + 10, yy, 74, 1)
        box(c, px + 96, yy - 2, lw - 150, 6, None, fill=FILL2)
        box(c, px + 96, yy - 2, (lw - 150) * [.8, .55, .35, .18][r], 6, None, fill=FILL3)

    # quick actions
    box(c, rx, ROW2_Y, rw, ROW2_H, None, fill=WHITE)
    head(c, rx + 4, ROW2_Y + ROW2_H - 12, 'QUICK ACTIONS', 4)
    for q in range(5):
        yy = ROW2_Y + ROW2_H - 30 - q * 13
        box(c, rx + 10, yy, 12, 10, None, fill=FILL3)
        lines(c, rx + 27, yy + 6, 84, 1)

    # alerts
    box(c, rx, ROW3_Y, rw, ROW3_H, None, fill=WHITE)
    head(c, rx + 4, ROW3_Y + ROW3_H - 12, 'LOW STOCK ALERTS', 5)
    for a in range(3):
        yy = ROW3_Y + ROW3_H - 32 - a * 18
        c.setFillColor(FILL3)
        c.circle(rx + 15, yy + 4, 3, stroke=0, fill=1)
        lines(c, rx + 24, yy + 6, 96, 2, gap=6)

    notes(c, [
        ('Four figures, never more.',
         'Occupancy, rooms free, arrivals and low stock are what staff act on when '
         'they sit down. A fifth tile wraps the row and weakens the hierarchy.'),
        ('Occupancy gets the largest block.',
         'A week of bars answers "are we filling up" faster than a table, and today '
         'is marked so the reader has an anchor.'),
        ('Hostel and canteen share one screen.',
         'The charter asks for a single platform, so the two sides of the operation '
         'are deliberately not split across separate dashboards.'),
        ('Quick actions sit top right.',
         'Shortcuts to the task a user arrived wanting to do. The eye finishes a '
         'left to right scan here, so it is where an action belongs.'),
        ('Alerts are a list, not a chart.',
         'A low stock warning has to name the item. A chart would hide exactly the '
         'detail that makes the alert worth showing.'),
    ])


# --------------------------------------------------- 2. Scheduling calendar
def draw_calendar(c):
    app_chrome(c, 'Operations', active_row=3)
    px, cw = content_x()

    text(c, px, TITLE_Y, 'Scheduling & Calendar', size=9, color=INK, bold=True)

    lw = cw - 156
    rx = px + lw + 12
    rw = 144

    # toolbar
    tb_y = ROW1_Y + 12
    box(c, px, tb_y, lw, 22, None, fill=FILL2)
    marker(c, px + 12, tb_y + 11, 1)
    box(c, px + 24, tb_y + 4, 15, 14, '<', size=6, fill=WHITE, align='center')
    text(c, px + 46, tb_y + 8, 'September 2026', size=7, bold=True, color=INK)
    box(c, px + 118, tb_y + 4, 15, 14, '>', size=6, fill=WHITE, align='center')
    box(c, px + lw - 94, tb_y + 4, 44, 14, 'Month', size=6, fill=FILL3, align='center')
    box(c, px + lw - 48, tb_y + 4, 44, 14, 'Timeline', size=6, fill=WHITE, align='center')

    # month grid
    grid_top = ROW1_Y + 4
    cols, rows = 7, 5
    colw = lw / float(cols)
    ch = (grid_top - 14 - BOTTOM) / float(rows)
    for i, dow in enumerate(['S', 'M', 'T', 'W', 'T', 'F', 'S']):
        box(c, px + i * colw, grid_top - 14, colw, 14, dow, fill=FILL2, size=6,
            align='center')
    for r in range(rows):
        for col in range(cols):
            cx = px + col * colw
            cy = grid_top - 14 - (r + 1) * ch
            today = (r == 1 and col == 3)
            day_no = r * 7 + col + 1
            outside = day_no > 30
            box(c, cx, cy, colw, ch, None,
                fill=FILL2 if today else (HexColor('#fbf9f9') if outside else WHITE))
            text(c, cx + 4, cy + ch - 9, str(day_no if not outside else day_no - 30),
                 size=6, color=FAINT if outside else INK)
            if not outside:
                text(c, cx + colw - 5, cy + ch - 9, '4/22', size=5, color=FAINT,
                     align='right')
            if outside:
                continue
            if (r + col) % 3 != 1:
                box(c, cx + 3, cy + ch - 20, colw - 7, 7, None, fill=FILL3)
            if (r + col) % 4 == 0:
                box(c, cx + 3, cy + ch - 29, colw - 7, 7, None, fill=FILL)
    marker(c, px - 6, grid_top - 8, 2)

    # selected day
    day_h = 118
    day_y = ROW1_Y + 34 - day_h
    box(c, rx, day_y, rw, day_h, None, fill=WHITE)
    head(c, rx + 4, day_y + day_h - 12, 'SELECTED DAY', 3)
    for i in range(4):
        yy = day_y + day_h - 32 - i * 21
        box(c, rx + 12, yy, 2.5, 15, None, fill=FILL3, stroke=None)
        lines(c, rx + 20, yy + 11, 108, 2, gap=6)

    # conflicts
    con_h = day_y - 8 - BOTTOM
    box(c, rx, BOTTOM, rw, con_h, None, fill=WHITE)
    head(c, rx + 4, BOTTOM + con_h - 12, 'CONFLICT DETECTION', 4)
    for i in range(3):
        yy = BOTTOM + con_h - 34 - i * 22
        box(c, rx + 10, yy, 124, 18, None, fill=FILL2)
        box(c, rx + 10, yy, 2.5, 18, None, fill=FILL3, stroke=None)
        lines(c, rx + 18, yy + 12, 100, 2, gap=6)

    notes(c, [
        ('Two views, one switch.',
         'A month grid answers "what happens on the 14th". A room timeline answers '
         '"which rooms are free next week". Front desk staff need both, so the '
         'switch sits in the toolbar rather than on a separate page.'),
        ('Every day cell carries a load figure.',
         'A small count in the corner lets a staff member judge availability '
         'without opening the day.'),
        ('The detail panel never covers the calendar.',
         'Clicking a day fills the right column instead of opening a dialog, so the '
         'reader keeps their place in the month.'),
        ('Conflicts are listed, not just blocked.',
         'A refusal has to say what it clashed with. Each finding names the booking '
         'or room block it hit so the user can act on it.'),
    ])


# ----------------------------------------------------------- 3. Audit trail
def draw_audit(c):
    app_chrome(c, 'Administration', active_row=6)
    px, cw = content_x()

    text(c, px, TITLE_Y, 'Audit Trail', size=9, color=INK, bold=True)

    # filter bar
    fb_y = ROW1_Y + 10
    box(c, px, fb_y, cw, 24, None, fill=FILL2)
    marker(c, px + 12, fb_y + 12, 1)
    box(c, px + 26, fb_y + 4, 118, 16, 'search user or action', size=6, fill=WHITE)
    box(c, px + 150, fb_y + 4, 76, 16, 'date from', size=6, fill=WHITE, align='center')
    box(c, px + 232, fb_y + 4, 76, 16, 'date to', size=6, fill=WHITE, align='center')
    box(c, px + 314, fb_y + 4, 70, 16, 'action type', size=6, fill=WHITE, align='center')
    marker(c, px + cw - 14, fb_y + 12, 4)

    # table
    heads = ['TIMESTAMP', 'USER', 'ACTION', 'RECORD', 'RESULT']
    colx = [0, 112, 194, 336, 448]
    th_y = fb_y - 22
    box(c, px, th_y, cw, 18, None, fill=FILL2)
    for i, hd in enumerate(heads):
        text(c, px + 8 + colx[i], th_y + 6, hd, size=5.5, bold=True, color=FAINT)
    marker(c, px + cw - 14, th_y + 9, 3)

    n_rows = int((th_y - BOTTOM) / 19)
    for r in range(n_rows):
        yy = th_y - (r + 1) * 19
        box(c, px, yy, cw, 19, None, fill=WHITE if r % 2 else FILL2, stroke=None)
        c.setStrokeColor(HexColor('#eae5e6'))
        c.line(px, yy, px + cw, yy)
        lines(c, px + 8, yy + 11, 84, 1)
        lines(c, px + 8 + colx[1], yy + 11, 60, 1)
        lines(c, px + 8 + colx[2], yy + 11, 112, 1)
        lines(c, px + 8 + colx[3], yy + 11, 84, 1)
        box(c, px + 8 + colx[4], yy + 5, 40, 10, None, fill=FILL3)
    marker(c, px - 6, th_y - 10, 2)

    notes(c, [
        ('Time reads first, left to right.',
         'An audit trail is read chronologically. The timestamp takes the first '
         'column so a reader can scan down it without crossing the row.'),
        ('One row is one event.',
         'Who, what, which record, and what happened. Nothing is grouped or '
         'summarised, because an audit trail that hides rows is not an audit trail.'),
        ('Result is a marker, not a sentence.',
         'Success and failure need to be separable at a glance while scanning '
         'hundreds of rows, and must not rely on colour alone.'),
        ('Filtering is the whole feature.',
         'A log is only useful if you can narrow it. Date range, user and action '
         'type sit above the table, always visible, never behind a menu.'),
    ])


# --------------------------------------------------------------- 4. Reports
def draw_reports(c):
    app_chrome(c, 'Administration', active_row=5)
    px, cw = content_x()

    text(c, px, TITLE_Y, 'Reports', size=9, color=INK, bold=True)
    box(c, px + cw - 60, TITLE_Y - 5, 60, 15, 'Export', size=6, fill=WHITE,
        align='center')

    lw = cw - 176
    rx = px + lw + 12
    rw = 164
    top = ROW1_Y + 34
    height = top - BOTTOM

    # summary
    box(c, px, BOTTOM, lw, height, None, fill=WHITE)
    head(c, px + 4, top - 12, 'REPORT SUMMARY', 1)
    blocks = ['HOSTEL OCCUPANCY', 'RESERVATION STATUS', 'CANTEEN INVENTORY', 'REVENUE']
    yy = top - 30
    for bl in blocks:
        text(c, px + 10, yy, bl, size=5.5, bold=True, color=FAINT)
        c.setStrokeColor(HexColor('#e4dedf'))
        c.line(px + 10, yy - 4, px + lw - 10, yy - 4)
        for r in range(2):
            ry = yy - 15 - r * 11
            lines(c, px + 10, ry, 116, 1)
            box(c, px + lw - 62, ry - 2, 46, 6, None, fill=FILL3)
        yy -= 50
    marker(c, px + lw - 72, top - 42, 2)

    # controls
    box(c, rx, BOTTOM, rw, height, None, fill=WHITE)
    head(c, rx + 4, top - 12, 'REPORT CONTROLS', 3)
    fields = ['Report type', 'Date from', 'Date to', 'Module']
    for i, f in enumerate(fields):
        fy = top - 46 - i * 30
        text(c, rx + 12, fy + 15, f, size=5.5, color=FAINT)
        box(c, rx + 12, fy, 140, 14, None, fill=FILL2)
    gen_y = BOTTOM + 14
    box(c, rx + 12, gen_y, 140, 18, 'Generate report', size=6.5,
        fill=FILL3, align='center', bold=True)
    marker(c, rx + 4, gen_y + 9, 4)

    notes(c, [
        ('The summary is the page, the controls are the sidebar.',
         'People open reports to read a figure, not to configure one. The result '
         'takes the dominant column and the settings sit beside it.'),
        ('Figures right aligned in a fixed column.',
         'Numbers are compared down the page, not across, so they line up on a '
         'single edge in tabular figures.'),
        ('Controls stay visible while reading.',
         'Adjusting a date range and seeing the summary change is the main loop of '
         'this screen, so the panel never collapses or moves behind a dialog.'),
        ('One primary action.',
         'Generate is the only filled control on the screen. Everything else is a '
         'field or a plain button, so there is no doubt what to press.'),
    ])


# ------------------------------------------------- Santos placeholder pages
def draw_placeholder(c, module, wbs, scope):
    bx, by = FX, FY + 52
    bw, bh = FW, (FY + FH - 16) - by
    box(c, bx, by, bw, bh, None, fill=FILL2, stroke=LINE, dash=True)

    cx = bx + bw / 2.0
    top = by + bh

    text(c, cx, top - 56, 'Wireframe to be produced by', size=10, color=MUT,
         align='center')
    text(c, cx, top - 80, 'Andrew Jacob E. Santos', size=16, color=INK,
         bold=True, align='center')
    text(c, cx, top - 102, 'WBS ' + wbs + '  |  ' + module, size=8.5, color=MUT,
         align='center')

    c.setStrokeColor(LINE)
    c.setLineWidth(0.6)
    c.line(cx - 110, top - 120, cx + 110, top - 120)

    text(c, cx, top - 140, 'SCREEN SHOULD COVER', size=6.5, color=FAINT,
         bold=True, align='center')
    yy = top - 158
    for line in scope:
        text(c, cx, yy, line, size=8.5, color=MUT, align='center')
        yy -= 15

    text(c, cx, by - 22,
         'Placeholder page. This module is not this developer’s wireframing task.',
         size=7.5, color=FAINT, align='center')


# ------------------------------------------------------------------- cover
def draw_cover(c, total):
    c.setFillColor(HexColor('#2b0c0e'))
    c.rect(0, H - 150, W, 150, stroke=0, fill=1)

    logo = os.path.join('assets', 'img', 'bpsu-logo.png')
    if os.path.exists(logo):
        try:
            c.drawImage(logo, M, H - 128, width=76, height=100,
                        mask='auto', preserveAspectRatio=True)
        except Exception:
            pass

    text(c, M + 100, H - 58, 'Hotel Reservation System and Inventory System',
         size=17, color=WHITE, bold=True)
    text(c, M + 100, H - 78, 'IGP PATVEP Hostel and University Canteen', size=11,
         color=HexColor('#d8c9ca'))
    text(c, M + 100, H - 104, 'Bataan Peninsula State University, Main Campus',
         size=8.5, color=HexColor('#a08b8d'))

    text(c, M, H - 190, 'UI WIREFRAME DOCUMENT', size=20, color=INK, bold=True)
    y = wrap(c,
             'Layout studies for the seven screens of the system. Low fidelity on '
             'purpose: grey blocks, labels and annotations. A wireframe settles '
             'layout, hierarchy and flow. Colour, type and spacing are settled '
             'separately in the build.',
             M, H - 214, W * 0.56, size=9.5, leading=13)

    text(c, M, y - 16, 'PREPARED BY', size=7, color=FAINT, bold=True)
    text(c, M, y - 32, 'Angelo Andrei P. Sierra', size=10.5, color=INK, bold=True)
    text(c, M, y - 46, 'Frontend and UI/UX Developer, BSIT-NW3A', size=8.5, color=MUT)

    # contents
    cx = W * 0.62
    text(c, cx, H - 190, 'CONTENTS', size=7, color=FAINT, bold=True)
    rows = [
        ('Dashboard', '8.1', 'A. Sierra'),
        ('Scheduling & Calendar', '6.1', 'A. Sierra'),
        ('Audit Trail', '7.1', 'A. Sierra'),
        ('Reports', '9.1', 'A. Sierra'),
        ('User Management', '3.1', 'A. Santos'),
        ('Canteen Inventory', '4.1', 'A. Santos'),
        ('Hotel Reservation', '5.1', 'A. Santos'),
    ]
    yy = H - 210
    for i, (name, wbs, who) in enumerate(rows):
        c.setStrokeColor(HexColor('#e4dedf'))
        c.line(cx, yy - 5, W - M, yy - 5)
        text(c, cx, yy, '%d.' % (i + 1), size=8, color=FAINT)
        text(c, cx + 16, yy, name, size=9, color=INK)
        text(c, cx + 160, yy, 'WBS ' + wbs, size=7.5, color=MUT)
        text(c, W - M, yy, who, size=7.5, color=MUT, align='right')
        yy -= 22

    text(c, M, 46, 'Generated ' + __import__('datetime').date.today().strftime('%B %d, %Y')
         + '   |   ' + str(total) + ' pages', size=7.5, color=FAINT)


# -------------------------------------------------------------------- build
def build(path):
    c = canvas.Canvas(path, pagesize=landscape(A4))
    c.setTitle('PATVEP Hostel and Canteen System - UI Wireframes')
    c.setAuthor('Angelo Andrei P. Sierra')
    c.setSubject('UI wireframe document')

    sierra = [
        ('Dashboard', '8.1', draw_dashboard),
        ('Scheduling & Calendar', '6.1', draw_calendar),
        ('Audit Trail', '7.1', draw_audit),
        ('Reports', '9.1', draw_reports),
    ]
    santos = [
        ('User Management', '3.1',
         ['Account list with search and role filter',
          'Create, edit and deactivate an account',
          'Role assignment and permission control',
          'User information update']),
        ('Canteen Inventory', '4.1',
         ['Item list for food, beverages and supplies',
          'Stock in and stock out recording',
          'Low stock alerts against reorder points',
          'Supplier and delivery records']),
        ('Hotel Reservation', '5.1',
         ['Room list with type, rate and availability',
          'Create, confirm, modify and cancel a booking',
          'Guest check-in and check-out',
          'Billing, payment entry and receipts']),
    ]

    total = 1 + len(sierra) + len(santos)
    page = 1

    draw_cover(c, total)
    c.showPage()

    for name, wbs, fn in sierra:
        page += 1
        page_header(c, name, wbs, 'Angelo Andrei P. Sierra', built=True)
        fn(c)
        page_footer(c, page, total)
        c.showPage()

    for name, wbs, scope in santos:
        page += 1
        page_header(c, name, wbs, 'Andrew Jacob E. Santos', built=False)
        draw_placeholder(c, name, wbs, scope)
        page_footer(c, page, total)
        c.showPage()

    c.save()
    return total


if __name__ == '__main__':
    out = os.path.join('wireframes', 'PATVEP-UI-Wireframes.pdf')
    os.makedirs('wireframes', exist_ok=True)
    n = build(out)
    print('wrote %s (%d pages, %d KB)' % (out, n, os.path.getsize(out) // 1024))
