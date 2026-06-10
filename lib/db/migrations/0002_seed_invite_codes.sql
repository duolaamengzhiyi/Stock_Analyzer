-- ====================================================================
-- 0002_seed_invite_codes.sql · 邀请码种子（FR-002 唯一允许的邀请码）
-- 本期单条；首次执行幂等（ON CONFLICT 跳过）。
-- ====================================================================
INSERT INTO "invite_codes" ("code", "reusable", "description")
VALUES (
  'violet-everGarden',
  true,
  '本期唯一允许的邀请码（FR-002）'
)
ON CONFLICT ("code") DO NOTHING;
