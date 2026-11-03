"""services/query_rewriter_service.py — Smart T-SQL Query Rewriter & Anti-Pattern Engine."""
from __future__ import annotations

import re
from typing import List, Tuple
from app.schemas.query_rewriter import DetectedAntiPattern, RewriteQueryResponse


def rewrite_tsql_query(query_text: str, database: str | None = None) -> RewriteQueryResponse:
    """Analyze T-SQL query for performance anti-patterns, non-SARGable clauses, and generate rewritten SQL."""
    original = query_text.strip()
    if not original:
        return RewriteQueryResponse(
            original_query="",
            rewritten_query="",
            anti_patterns_found=0,
            estimated_improvement_pct=0.0,
            detected_patterns=[],
            explanation_summary="Boş sorgu metni gönderildi.",
        )

    rewritten = original
    patterns: List[DetectedAntiPattern] = []

    # ── Rule 1: Non-SARGable YEAR(col) = YYYY ─────────────────────────────
    # Example: YEAR(o.OrderDate) = 2026 -> o.OrderDate >= '2026-01-01' AND o.OrderDate < '2027-01-01'
    year_regex = re.compile(
        r"YEAR\s*\(\s*([a-zA-Z0-9_\.\[\]]+)\s*\)\s*=\s*['\"]?(\d{4})['\"]?",
        re.IGNORECASE,
    )
    for match in year_regex.finditer(original):
        col, year_str = match.group(1), match.group(2)
        year_int = int(year_str)
        next_year = year_int + 1
        orig_frag = match.group(0)
        new_frag = f"{col} >= '{year_int}-01-01' AND {col} < '{next_year}-01-01'"
        rewritten = rewritten.replace(orig_frag, new_frag)
        patterns.append(
            DetectedAntiPattern(
                rule_id="AP-SARG-01",
                category="SARGability & İndeksleme",
                severity="HIGH",
                title="İndeks Aramasını Engelleyen Fonksiyon (YEAR() Çağrısı)",
                original_fragment=orig_frag,
                suggested_fragment=new_frag,
                explanation=f"Kolonun üzerine YEAR({col}) fonksiyonu koymak SQL Server'ın indeksi Seek ile okumasını engeller; tüm tabloyu taramak (Scan) zorunda kalır. Aralık filtresi (`>= '{year_int}-01-01' AND < '{next_year}-01-01'`) ile doğrudan Index Seek kullanılır.",
            )
        )

    # ── Rule 2: Non-SARGable LEFT(col, N) = 'XYZ' ──────────────────────────
    # Example: LEFT(CustomerCode, 3) = 'TRX' -> CustomerCode LIKE 'TRX%'
    left_regex = re.compile(
        r"LEFT\s*\(\s*([a-zA-Z0-9_\.\[\]]+)\s*,\s*(\d+)\s*\)\s*=\s*'([^']+)'",
        re.IGNORECASE,
    )
    for match in left_regex.finditer(original):
        col, _, val = match.group(1), match.group(2), match.group(3)
        orig_frag = match.group(0)
        new_frag = f"{col} LIKE '{val}%'"
        rewritten = rewritten.replace(orig_frag, new_frag)
        patterns.append(
            DetectedAntiPattern(
                rule_id="AP-SARG-02",
                category="SARGability & İndeksleme",
                severity="HIGH",
                title="Non-SARGable Metin Fonksiyonu (LEFT() Çağrısı)",
                original_fragment=orig_frag,
                suggested_fragment=new_frag,
                explanation=f"`LEFT({col}, ...)` fonksiyonu her satır için çalışır ve indeks kullanımını engeller. `LIKE '{val}%'` önek araması indeksin B-Tree hiyerarşisini kullanarak doğrudan Index Seek yapmasını sağlar.",
            )
        )

    # ── Rule 3: IF (SELECT COUNT(*) ...) > 0 vs IF EXISTS (SELECT 1 ...) ──
    # Example: IF (SELECT COUNT(*) FROM Customers WHERE ...) > 0 -> IF EXISTS (SELECT 1 FROM Customers WHERE ...)
    count_exists_regex = re.compile(
        r"IF\s*\(\s*SELECT\s+COUNT\s*\(\s*[\*1]\s*\)\s+FROM\s+([^\)]+)\)\s*>\s*0",
        re.IGNORECASE,
    )
    for match in count_exists_regex.finditer(original):
        from_part = match.group(1).strip()
        orig_frag = match.group(0)
        new_frag = f"IF EXISTS (SELECT 1 FROM {from_part})"
        rewritten = rewritten.replace(orig_frag, new_frag)
        patterns.append(
            DetectedAntiPattern(
                rule_id="AP-EXISTS-01",
                category="Performans & I/O",
                severity="HIGH",
                title="COUNT(*) ile Varlık Kontrolü Anti-Pattern'ı",
                original_fragment=orig_frag,
                suggested_fragment=new_frag,
                explanation="`COUNT(*)` tablodaki tüm eşleşen kayıtları sonuna kadar sayar. `EXISTS` ise ilk eşleşen kaydı bulduğu anda aramayı durdurur (Short-circuiting), devasa I/O tasarrufu sağlar.",
            )
        )

    # ── Rule 4: SELECT * Anti-Pattern ──────────────────────────────────────
    if re.search(r"\bSELECT\s+\*\s+FROM\b", original, re.IGNORECASE):
        patterns.append(
            DetectedAntiPattern(
                rule_id="AP-SEL-STAR",
                category="Sorgu Mimarisi",
                severity="MEDIUM",
                title="Geniş 'SELECT *' Projeksiyonu",
                original_fragment="SELECT * FROM",
                suggested_fragment="SELECT [Kolon1], [Kolon2], ... FROM",
                explanation="`SELECT *` kullanıldığında SQL Server tablodaki tüm kolonları (özellikle VARCHAR(MAX), XML veya geniş metinler dahil) okumak zorundadır. Bu durum belleği şişirir ve 'Covering Index' avantajını tamamen ortadan kaldırır. Yalnızca gereken kolonları talep edin.",
            )
        )

    # ── Rule 5: Leading Wildcard LIKE '%XYZ' ───────────────────────────────
    leading_wildcard = re.findall(r"LIKE\s*'\%[^']+'", original, re.IGNORECASE)
    if leading_wildcard:
        patterns.append(
            DetectedAntiPattern(
                rule_id="AP-LIKE-LEAD",
                category="SARGability & İndeksleme",
                severity="HIGH",
                title="Başında Yüzde İçeren 'LIKE %...' Arama Deseni",
                original_fragment=leading_wildcard[0],
                suggested_fragment="LIKE 'Metin%' veya Full-Text Search (CONTAINS)",
                explanation="Başında joker karakter (`%`) bulunan filtrelerde B-Tree indeksin sol tarafı bilinemediği için SQL Server asla Index Seek yapamaz ve tüm tabloyu tarar (Full Scan). Kelime aramaları için Full-Text Search veya sonda joker (`Metin%`) kullanılmalıdır.",
            )
        )

    # ── Rule 6: ISNULL(col, default) = val in WHERE ────────────────────────
    isnull_regex = re.compile(
        r"ISNULL\s*\(\s*([a-zA-Z0-9_\.\[\]]+)\s*,\s*([^)]+)\)\s*=\s*([^ \n\r\)]+)",
        re.IGNORECASE,
    )
    for match in isnull_regex.finditer(original):
        col, dflt, val = match.group(1), match.group(2).strip(), match.group(3).strip()
        orig_frag = match.group(0)
        if dflt == val:
            new_frag = f"({col} = {val} OR {col} IS NULL)"
        else:
            new_frag = f"{col} = {val}"
        rewritten = rewritten.replace(orig_frag, new_frag)
        patterns.append(
            DetectedAntiPattern(
                rule_id="AP-SARG-03",
                category="SARGability & İndeksleme",
                severity="MEDIUM",
                title="ISNULL() ile Kolon Sarmalama (Non-SARGable)",
                original_fragment=orig_frag,
                suggested_fragment=new_frag,
                explanation=f"`ISNULL({col}, ...)` fonksiyonu indeksi kapatır. Koşulu açık OR veya IS NULL olarak yazmak indeks kullanımına olanak tanır.",
            )
        )

    # ── Rule 7: TOP 100 PERCENT with ORDER BY in Subquery ───────────────────
    if re.search(r"TOP\s+100\s+PERCENT\b.*ORDER\s+BY", original, re.IGNORECASE):
        patterns.append(
            DetectedAntiPattern(
                rule_id="AP-TOP-100",
                category="Sorgu Mimarisi",
                severity="MEDIUM",
                title="Alt Sorguda 'TOP 100 PERCENT ... ORDER BY' Yanılsaması",
                original_fragment="TOP 100 PERCENT ... ORDER BY",
                suggested_fragment="ORDER BY ifadesini yalnızca en dış sorguya taşıyın",
                explanation="SQL Server standartlarına göre alt sorgu veya view içinde kullanılan `TOP 100 PERCENT ... ORDER BY` nihai sonucun sıralanacağını garanti etmez; gereksiz yere işlemci tüketir.",
            )
        )

    # ── Rule 8: NOLOCK Dirty Read Risk ─────────────────────────────────────
    if re.search(r"WITH\s*\(\s*NOLOCK\s*\)|(?:\s+NOLOCK\b)", original, re.IGNORECASE):
        patterns.append(
            DetectedAntiPattern(
                rule_id="AP-NOLOCK-HAZ",
                category="Kilit & Güvenlik",
                severity="LOW",
                title="Aşırı 'WITH (NOLOCK)' Kullanımı ve Kirli Okuma Riski",
                original_fragment="WITH (NOLOCK)",
                suggested_fragment="READ COMMITTED SNAPSHOT ISOLATION (RCSI)",
                explanation="`NOLOCK` kullanımı kilit beklemelerini önlese de commit edilmemiş kirli verilerin okunmasına (Dirty Read), satırların iki kez sayılmasına veya hiç okunmamasına yol açabilir. Veritabanı düzeyinde `READ_COMMITTED_SNAPSHOT ON` açılması çok daha güvenli ve modern bir çözümdür.",
            )
        )

    # ── Rule 9: Scalar UDF Call in WHERE/SELECT ────────────────────────────
    scalar_udf = re.findall(r"\bdbo\.fn_[a-zA-Z0-9_]+\s*\(", original, re.IGNORECASE)
    if scalar_udf:
        patterns.append(
            DetectedAntiPattern(
                rule_id="AP-UDF-SCALAR",
                category="Performans",
                severity="HIGH",
                title="Skaler Kullanıcı Tanımlı Fonksiyon (Scalar UDF - RBAR)",
                original_fragment=scalar_udf[0] + "...)",
                suggested_fragment="Inline Table-Valued Function (iTVF) veya CROSS APPLY",
                explanation="Skaler UDF'ler SQL Server'da tek iş parçacıklı (single-threaded) çalışmaya zorlar ve satır satır işletilir (Row-By-Agonizing-Row). Sorgu süresini 10 ila 100 kat artırabilir.",
            )
        )

    # Calculate estimated improvement percentage
    imp = 0.0
    for p in patterns:
        if p.severity == "HIGH":
            imp += 30.0
        elif p.severity == "MEDIUM":
            imp += 15.0
        elif p.severity == "LOW":
            imp += 5.0
    improvement_pct = min(95.0, imp) if patterns else 0.0

    summary_msg = (
        f"{len(patterns)} adet optimizasyon fırsatı ve anti-pattern tespit edildi. "
        f"Tahmini I/O ve yürütme süresi iyileşmesi: ~%{improvement_pct:.0f}."
        if patterns
        else "Sorguda belirgin bir anti-pattern tespit edilmedi; sözdizimi temiz görünüyor."
    )

    return RewriteQueryResponse(
        original_query=original,
        rewritten_query=rewritten,
        anti_patterns_found=len(patterns),
        estimated_improvement_pct=improvement_pct,
        detected_patterns=patterns,
        explanation_summary=summary_msg,
    )
