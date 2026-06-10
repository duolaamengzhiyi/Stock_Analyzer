/**
 * MagicCard 薄封装：业务侧统一从 @/components/magic 导入，
 * 底层实现由 Magic UI registry 落到 @/components/ui/magic-card.tsx。
 * 后续替换实现时仅改此封装即可，业务无感。
 */
export { MagicCard } from "@/components/ui/magic-card";
