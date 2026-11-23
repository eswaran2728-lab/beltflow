"""Builds docs/plan/BeltFlow_Plan_A_to_Z.pdf (run: python3 docs/plan/build_plan_pdf.py)."""
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table,
                                TableStyle, PageBreak, KeepTogether)

NAVY = colors.HexColor('#0F1B33')
AMBER = colors.HexColor('#E8890C')
INK = colors.HexColor('#1E293B')
MUTED = colors.HexColor('#5B6476')
LINE = colors.HexColor('#D9DEE7')
SOFT = colors.HexColor('#F4F6FA')
GREEN = colors.HexColor('#15803D')
RED = colors.HexColor('#B91C1C')
ORANGE = colors.HexColor('#B45309')

base = dict(fontName='Helvetica', textColor=INK)
S = {
    'h1': ParagraphStyle('h1', fontName='Helvetica-Bold', fontSize=18, leading=22, textColor=NAVY, spaceBefore=4, spaceAfter=8),
    'h2': ParagraphStyle('h2', fontName='Helvetica-Bold', fontSize=12.5, leading=16, textColor=NAVY, spaceBefore=10, spaceAfter=4),
    'p': ParagraphStyle('p', fontSize=10, leading=14.5, spaceAfter=5, **base),
    'small': ParagraphStyle('small', fontSize=8.5, leading=11.5, textColor=MUTED, fontName='Helvetica'),
    'cell': ParagraphStyle('cell', fontSize=8.8, leading=11.5, **base),
    'cellb': ParagraphStyle('cellb', fontSize=8.8, leading=11.5, fontName='Helvetica-Bold', textColor=INK),
    'head': ParagraphStyle('head', fontSize=8.8, leading=11.5, fontName='Helvetica-Bold', textColor=colors.white),
    'bullet': ParagraphStyle('bullet', fontSize=10, leading=14, leftIndent=12, bulletIndent=2, spaceAfter=2, **base),
}


def P(t, s='p'):
    return Paragraph(t, S[s])


def bullets(items):
    return [Paragraph(i, S['bullet'], bulletText='•') for i in items]


def table(rows, widths, header=True):
    data = []
    for r, row in enumerate(rows):
        style = 'head' if header and r == 0 else 'cell'
        data.append([c if not isinstance(c, str) else Paragraph(c, S[style]) for c in row])
    t = Table(data, colWidths=widths, repeatRows=1 if header else 0)
    ts = [('VALIGN', (0, 0), (-1, -1), 'TOP'),
          ('GRID', (0, 0), (-1, -1), 0.4, LINE),
          ('LEFTPADDING', (0, 0), (-1, -1), 5), ('RIGHTPADDING', (0, 0), (-1, -1), 5),
          ('TOPPADDING', (0, 0), (-1, -1), 3.5), ('BOTTOMPADDING', (0, 0), (-1, -1), 3.5)]
    if header:
        ts.append(('BACKGROUND', (0, 0), (-1, 0), NAVY))
        for i in range(1, len(rows)):
            if i % 2 == 0:
                ts.append(('BACKGROUND', (0, i), (-1, i), SOFT))
    t.setStyle(TableStyle(ts))
    return t


def status(word):
    c = {'DONE': GREEN, 'PASS': GREEN, 'PARTIAL': ORANGE, 'CONDITIONAL': ORANGE, 'OPEN': RED, 'OWNER': RED}.get(word.split()[0], INK)
    return Paragraph(f'<font color="{c.hexval().replace("0x", "#")}"><b>{word}</b></font>', S['cell'])


def on_page(canv, doc):
    w, h = A4
    canv.saveState()
    if doc.page == 1:
        canv.setFillColor(NAVY)
        canv.rect(0, h - 95 * mm, w, 95 * mm, stroke=0, fill=1)
        canv.setFillColor(AMBER)
        canv.rect(0, h - 97 * mm, w, 2 * mm, stroke=0, fill=1)
        canv.setFillColor(colors.white)
        canv.setFont('Helvetica-Bold', 30)
        canv.drawString(20 * mm, h - 45 * mm, 'BeltFlow')
        canv.setFont('Helvetica', 15)
        canv.drawString(20 * mm, h - 56 * mm, 'The complete plan, A to Z')
        canv.setFont('Helvetica', 10)
        canv.setFillColor(colors.HexColor('#C9D2E3'))
        canv.drawString(20 * mm, h - 68 * mm, 'Martial arts academy platform for Malaysian Persatuans  |  Web, Android and iOS')
        canv.drawString(20 * mm, h - 75 * mm, 'Status as of 23 November 2026  |  main branch at commit 221e45b')
    else:
        canv.setFillColor(NAVY)
        canv.rect(0, h - 12 * mm, w, 12 * mm, stroke=0, fill=1)
        canv.setFillColor(colors.white)
        canv.setFont('Helvetica-Bold', 9)
        canv.drawString(15 * mm, h - 8 * mm, 'BeltFlow  |  Plan A to Z')
        canv.setFont('Helvetica', 8)
        canv.drawRightString(w - 15 * mm, h - 8 * mm, '23 November 2026')
    canv.setFillColor(MUTED)
    canv.setFont('Helvetica', 8)
    canv.drawString(15 * mm, 10 * mm, 'Prepared from the BeltFlow repository and handover documents. Synthetic data only.')
    canv.drawRightString(A4[0] - 15 * mm, 10 * mm, f'Page {doc.page}')
    canv.restoreState()


def build(path):
    doc = BaseDocTemplate(path, pagesize=A4, title='BeltFlow: The complete plan, A to Z',
                          author='BeltFlow', subject='BeltFlow plan and status, 23 November 2026')
    w, h = A4
    first = Frame(15 * mm, 18 * mm, w - 30 * mm, h - 120 * mm, id='first')
    rest = Frame(15 * mm, 18 * mm, w - 30 * mm, h - 36 * mm, id='rest')
    doc.addPageTemplates([PageTemplate('First', [first], onPage=on_page),
                          PageTemplate('Rest', [rest], onPage=on_page)])
    W = w - 30 * mm
    st = []
    from reportlab.platypus.doctemplate import NextPageTemplate
    st.append(NextPageTemplate('Rest'))

    # ---------------- Cover page body: summary
    st.append(P('In one page', 'h1'))
    st.append(P('BeltFlow is one system for a martial arts association (Persatuan) and its academies: classes, '
                'attendance, belt gradings, fees, notices and family updates, in English, Bahasa Malaysia and Tamil. '
                'Five kinds of people use it: the platform owner (Super Admin), the Persatuan Admin, instructors '
                '(Masters), parents and students.'))
    st.append(table([
        ['Area', 'Where it stands today'],
        ['Building the app (roadmap H00 to H28)', 'H00 to H26 done. H27 conditional pass (needs a real phone). H28 partial (translations need a native speaker, phone and user tests)'],
        ['Finishing work (Nov 2026)', 'Done and merged into main: premium look and logo, security hardening, privacy and legal pages, Play Store preparation, real data on every screen'],
        ['Automated checks', 'Server 54 of 54 test groups pass. Mobile 705 of 705 tests pass. GitHub builds pass'],
        ['Testing APK', 'Built on GitHub from main (run 45166485932), downloadable until 23 Dec 2026'],
        ['To go live', 'Owner steps: put the server online, business details and lawyer review, new signing key, Play Console, real-phone testing'],
    ], [55 * mm, W - 55 * mm]))
    st.append(Spacer(1, 6))
    st.append(P('Contents: A. The idea  |  B. Who uses it  |  C. Rules that never change  |  D. How it is built  |  '
                'E. The build roadmap H00 to H28  |  F. Work completed in November 2026  |  G. Where we are today  |  '
                'H. Path to launch, step by step  |  I. After launch  |  J. Decisions and risks  |  K. Where to find things', 'small'))
    st.append(PageBreak())

    # ---------------- A
    st.append(P('A. The idea', 'h1'))
    st.append(P('Most Malaysian Persatuans and academies run on WhatsApp groups, paper attendance and cash books. '
                'BeltFlow replaces that with one place where:'))
    st += bullets([
        'the Persatuan approves its instructors and their classes, sets its own belt system and syllabus, and sees fees and growth across all its classes;',
        'instructors take attendance (also offline, also by scanning a student QR pass), run gradings and send notices;',
        'parents follow their own children, pay fees through the academy and message the instructor;',
        'students see their pass, syllabus, progress and certificates.',
    ])
    st.append(P('Market: Malaysia first (Persatuans, dojangs, Silambam and other styles), then Southeast Asia. '
                'Languages: English, Bahasa Malaysia, Tamil. Each Persatuan is a separate, private space (multi-tenant SaaS).'))

    # ---------------- B
    st.append(P('B. Who uses it: exactly five roles', 'h1'))
    st.append(table([
        ['Role', 'What they do', 'Limits'],
        ['Super Admin (platform owner)', 'Onboards Persatuans, suspends or reactivates them, sees platform health and security events, handles Persatuan Admins’ privacy requests', 'Never sees individual children’s records, medical notes or parent messages'],
        ['Persatuan Admin', 'Approves Masters and classes, sets belts and syllabus, finance, reports, locations, gives password reset codes, handles members’ privacy requests', 'Only their own Persatuan'],
        ['Master (instructor)', 'Proposes classes, rosters, attendance (QR and offline), technique checklists, grading nominations, notices, parent messages', 'Only classes they lead or were handed over'],
        ['Parent', 'Children’s attendance, progress, gradings, notices, fees and payments, trials, make-up classes, messages', 'Only children linked and approved by student, Master and Admin'],
        ['Student', 'Signed QR pass, syllabus, attendance history, certificates, learning library, rewards', 'Only their own records'],
    ], [38 * mm, 85 * mm, W - 123 * mm]))
    st.append(P('Referee, judge or substitute instructor are permissions given for a task, never extra roles.', 'small'))

    # ---------------- C
    st.append(P('C. Rules that never change', 'h1'))
    st += bullets([
        '<b>Five roles only.</b> No new global roles.',
        '<b>Each Persatuan is sealed.</b> Every query is limited to the person’s own organisation; no data crosses between academies.',
        '<b>Children’s privacy.</b> The Super Admin never sees a child’s operational records.',
        '<b>Money records are append-only.</b> Payments and orders are written to a ledger that is never edited; a payment counts only when the server confirms it.',
        '<b>The AI assistant only reads.</b> It never changes a belt, approves an application or moves money, and it never decides who may see what.',
        '<b>The QR pass is signed by the server</b> (Ed25519) and carries no personal details.',
        '<b>Public repository: synthetic data only.</b> No keys, passwords, signing files or real student information in git.',
        '<b>No force-pushing, and no merge into main without the owner saying so.</b>',
    ])

    # ---------------- D
    st.append(P('D. How it is built', 'h1'))
    st.append(table([
        ['Part', 'Technology', 'Notes'],
        ['Server (API)', 'Node.js, Express, TypeScript, PostgreSQL', 'Embedded PostgreSQL (PGlite) for tests; production checks its own settings and refuses to start if any secret is missing or weak'],
        ['Mobile app', 'React Native with Expo 57, Android and iOS', 'Offline database and sync queue for attendance; Google Stitch design tokens; premium 3D theme and animated logo'],
        ['Web app', 'Single-page web app served by the server', 'Same server and rules as the phone app; self-hosted fonts and icons; no cookies, no trackers'],
        ['AI assistant', 'Server-side, Gemini provider', 'Read-only, answers with sources, admits when it does not know'],
        ['Hosting (prepared)', 'Dockerfile and Render blueprint, Singapore region', 'Same image can run on any host'],
        ['Builds', 'GitHub Actions', 'Testing APK on every push; Play Store bundle (AAB) built by hand, signed with the new upload key'],
    ], [30 * mm, 55 * mm, W - 85 * mm]))
    st.append(PageBreak())

    # ---------------- E
    st.append(P('E. The build roadmap: H00 to H28', 'h1'))
    rows = [['Task', 'What it covers', 'Status']]
    road = [
        ('H00', 'Architecture and the five roles', 'DONE'), ('H01', 'Separate data per Persatuan', 'DONE'),
        ('H02', 'Authority and moving old data', 'DONE'), ('H03', 'Master verification and affiliation', 'DONE'),
        ('H04', 'Class proposals, approval, discovery', 'DONE'), ('H05', 'Student applications and approvals', 'DONE'),
        ('H06', 'Master workspace and rosters', 'DONE'), ('H07', 'Class handover and substitute Masters', 'DONE'),
        ('H08', 'Signed QR student pass', 'DONE'), ('H09', 'Persatuan belt system and syllabus', 'DONE'),
        ('H10', 'Class schedules and sessions', 'DONE'), ('H11', 'Student safety and notices', 'DONE'),
        ('H12', 'Gradings and certificates', 'DONE'), ('H13', 'Payments, each Persatuan’s own merchant account', 'DONE'),
        ('H14', 'Academy setup and importing old records', 'DONE'), ('H15', 'Core pilot certification', 'DONE'),
        ('H16', 'Trial classes and conversion', 'DONE'), ('H17', 'Waitlists and make-up lessons', 'DONE'),
        ('H18', 'Transfers between academies', 'DONE'), ('H19', 'Lesson plans and family hub', 'DONE'),
        ('H20', 'Learning library and rewards', 'DONE'), ('H21', 'Private video feedback', 'DONE'),
        ('H22', 'Parent and Master messaging', 'DONE'), ('H23', 'Growth reports and exports', 'DONE'),
        ('H24', 'Tournaments (server and web)', 'DONE'), ('H25', 'Equipment shop (server and web)', 'DONE'),
        ('H26', 'Role-aware AI assistant (read-only)', 'PASS'),
        ('H27', 'Release certification', 'CONDITIONAL PASS: needs a real-phone test'),
        ('H28', 'Languages and usability', 'PARTIAL: native-speaker review, phone and user tests'),
    ]
    for code, what, stt in road:
        rows.append([code, what, status(stt)])
    st.append(table(rows, [16 * mm, 100 * mm, W - 116 * mm]))
    st.append(Spacer(1, 4))
    st.append(P('Tournaments (H24) and the equipment shop (H25) work on the server and the web app; the phone app has no screens for them yet.', 'small'))
    st.append(PageBreak())

    # ---------------- F
    st.append(P('F. Work completed in November 2026', 'h1'))
    st.append(table([
        ['Work', 'What it added', 'Merged'],
        ['Premium look and logo', 'New BeltFlow logo, premium 3D theme, motion graphics on all screens', 'PR #7'],
        ['Security hardening', 'Stronger password storage, lockout after 10 wrong passwords, security event log, one-time reset codes, HTTPS only, only approved files served, web fixes against script injection, safer dependencies', 'PR #8'],
        ['Privacy and legal (Malaysia PDPA)', 'Privacy notice, terms, cookies, refunds and account-deletion pages in English and BM; consent recorded at sign-up; download my data; requests to delete, correct or withdraw consent, answered within 21 days; staff handling on web and phone', 'PR #8'],
        ['Play Store preparation', 'Production server image, Render blueprint (Singapore), signed Play bundle workflow, store listing text and Data safety answers', 'PR #8'],
        ['Real data on every screen', 'Master students; parent children and notices; Admin locations and reports; student attendance and certificates; Super Admin Persatuan management and audit. Fake sample data removed. Server-signed QR pass. Password reset by code on phone and web', 'PR #8'],
    ], [38 * mm, W - 58 * mm, 20 * mm]))

    # ---------------- G
    st.append(P('G. Where we are today', 'h1'))
    st.append(table([
        ['Check', 'Result'],
        ['Server automated tests', status('PASS 54 of 54 test groups') ],
        ['Changed tests on real PostgreSQL 16', status('PASS')],
        ['Mobile automated tests', status('PASS 705 of 705, no type or lint errors')],
        ['Web password reset in a browser', status('PASS 13 of 13 checks')],
        ['GitHub builds (testing APK and bundle)', status('PASS')],
        ['Tested on a real phone', status('OPEN not yet')],
        ['Server online for real users', status('OPEN not yet')],
        ['Legal pages final', status('OPEN business details and lawyer review')],
        ['On Google Play', status('OPEN not yet')],
    ], [70 * mm, W - 70 * mm]))
    st.append(PageBreak())

    # ---------------- H
    st.append(P('H. Path to launch, step by step', 'h1'))
    st.append(P('Steps marked Owner need your accounts, payment or decision. Claude can do everything else once you give the go-ahead.'))
    steps = [
        ('1', 'Put the server online', 'Owner', 'Create a Render account, New > Blueprint > beltflow repo > Apply (Singapore). Check the price first. About 20 minutes. Send Claude the address.'),
        ('2', 'Create the first Super Admin', 'Owner', 'Copy BELTFLOW_SETUP_TOKEN from Render, open the website, "Initialize First Super Admin".'),
        ('3', 'Point the app at the server', 'Claude', 'Set BELTFLOW_API_URL on GitHub and rebuild the APK so it connects on its own.'),
        ('4', 'Business details and legal review', 'Owner', 'Fill legal/business.js (name, SSM number, address, e-mail, phone). A Malaysian lawyer reads the five legal pages. The "Draft" notices then disappear.'),
        ('5', 'Replace the leaked signing key', 'Owner', 'The old key is public in git history. Make a new upload key, ask Google Play for an upload key reset, add the four PLAY_UPLOAD_* secrets on GitHub.'),
        ('6', 'Test on real phones', 'Owner', 'Sign-in, attendance online and offline, QR scan with the signed pass, payment flow, privacy screen, pull to refresh, Share.'),
        ('7', 'Native-speaker check', 'Owner', 'Bahasa Malaysia and Tamil text in the app.'),
        ('8', 'Build the Play bundle', 'Claude or Owner', 'GitHub > Actions > "Build BeltFlow Play Store bundle (AAB)" > Run workflow on main.'),
        ('9', 'Play Console', 'Owner', 'App content, Data safety (answers prepared), store listing (text prepared), upload to internal testing.'),
        ('10', 'Closed test, then production', 'Owner', 'A new personal developer account needs 12 testers for 14 days. Then a staged rollout (for example 20%).'),
        ('11', 'First pilot Persatuan', 'Owner', 'Onboard one real Persatuan, import its records, train its Admin and Masters, collect feedback.'),
    ]
    rows = [['#', 'Step', 'Who', 'How']]
    for n, s, who, how in steps:
        rows.append([n, Paragraph(f'<b>{s}</b>', S['cell']), status('OWNER' if who == 'Owner' else who) if who == 'Owner' else who, how])
    st.append(table(rows, [8 * mm, 40 * mm, 22 * mm, W - 70 * mm]))
    st.append(P('Full instructions: docs/release/PLAY_STORE_RELEASE.md in the repository.', 'small'))

    # ---------------- I
    st.append(P('I. After launch', 'h1'))
    st += bullets([
        'Phone screens for tournaments and the equipment shop (already working on server and web).',
        'Push notifications to phones: built, needs an Expo project and Firebase key to switch on.',
        'E-mail and SMS notifications (not built).',
        'AI assistant on a paid Gemini key before it reads real data; Malay and Tamil review of its answers.',
        'Repeat the database checks on the managed production database.',
        'Remaining Google Stitch design work on older screens, and accessibility checks with real users.',
        'Regular backups and a tested restore, plus monitoring of the security event log.',
    ])

    # ---------------- J
    st.append(P('J. Decisions and risks', 'h1'))
    st.append(table([
        ['Item', 'Note'],
        ['Hosting cost', 'Render is recommended (Singapore, managed database, generated secrets). Check the monthly price before creating it. A move to Vercel is possible but needs extra server work.'],
        ['Leaked signing key', 'Must be replaced before any Play upload (step 5).'],
        ['Children under 13', 'Google Families policy applies if they sign in. BeltFlow has no ads and no analytics, which helps; decide who signs in for young children.'],
        ['Suspension reasons', 'Kept in the audit log as typed; staff are warned not to include personal details.'],
        ['Not yet tested on a phone', 'All checks so far are automated or in a browser.'],
        ['Legal pages', 'Drafts until business details are filled in and a lawyer has reviewed them.'],
    ], [38 * mm, W - 38 * mm]))

    # ---------------- K
    st.append(P('K. Where to find things', 'h1'))
    st.append(table([
        ['What', 'Where'],
        ['Code', 'github.com/eswaran2728-lab/beltflow (main branch)'],
        ['Start-here guide for developers', 'docs/claude-handover/08_CLAUDE_CODE_START_HERE.md'],
        ['Roadmap evidence', 'docs/claude-handover/02, 09, 10, 11'],
        ['Security', 'docs/claude-handover/12 and 13'],
        ['Privacy and legal', 'docs/claude-handover/14 and the legal/ folder'],
        ['App completion', 'docs/claude-handover/15_APP_COMPLETION_2026-11-22.md'],
        ['Play Store guide', 'docs/release/PLAY_STORE_RELEASE.md'],
        ['Testing APK', 'GitHub > Actions > run 45166485932 > Artifacts'],
        ['Original specification', 'BeltFlow_Complete_Structure_Implementation_and_Handoff_v2.pdf'],
    ], [55 * mm, W - 55 * mm]))

    doc.build(st)


if __name__ == '__main__':
    import os
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'BeltFlow_Plan_A_to_Z.pdf')
    build(out)
    print(out)
