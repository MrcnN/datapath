-- ============================================================================
-- Traceforge — Canlı Engelleme (Blocking) Simülasyonu
-- Nasıl Çalıştırılır?
-- 1. Bu pencereyi (Oturum 1) SSMS'te çalıştırın (İşlem açık bekleyecektir).
-- 2. Yeni bir sorgu penceresi açıp aşağıdaki 2. adımı çalıştırın.
-- 3. Traceforge arayüzünde "Olay Merkezi -> Engelleme Zincirleri"ne bakın!
-- 4. Test bittikten sonra bu pencerede ROLLBACK TRANSACTION çalıştırın.
-- ============================================================================

USE [Traceforge_TestDB];
GO

-- 1. PENCERE (HEAD BLOCKER): Tabloyu kilitler ve açık işlemde bekler:
BEGIN TRANSACTION;

UPDATE dbo.Orders WITH (TABLOCKX)
SET TotalAmount = TotalAmount + 10
WHERE OrderID = 1;

PRINT 'Kilit alındı. İşlem bekletiliyor (Traceforge ekranını kontrol edin)...';
-- WAITFOR DELAY '00:02:00'; -- 2 dakika boyunca kilitli tutar
-- Testiniz bitince aşağıdaki satırı seçip F5 yapın:
-- ROLLBACK TRANSACTION;
GO

/*
-- 2. PENCERE (YENİ SORGUDAN ÇALIŞTIRIN - BLOCKED SESSION OLACAK):
USE [Traceforge_TestDB];
SELECT * FROM dbo.Orders WHERE OrderID = 1;
*/
