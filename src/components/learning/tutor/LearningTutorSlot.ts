import { createContext, type ReactNode } from 'react';

// Arthur: NarIyirm
// 中文：主动帮助留在正文后，助手入口固定在顶部；底部只保留课程操作与正式考试提示，不挤压完成按钮。
// EN: Keep proactive help after the lesson and the assistant in the header; the footer holds only lesson actions and formal-assessment notices without squeezing completion buttons.
export const LearningTutorSlot = createContext<{ body?: ReactNode; header?: ReactNode; notice?: ReactNode } | null>(null);
