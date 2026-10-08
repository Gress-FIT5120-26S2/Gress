import { createContext, type ReactNode } from 'react';

// Arthur: NarIyirm
// 中文：主动帮助留在正文后，问答入口放入固定操作区，避免导师内容抢占课程开头。
// EN: Keep proactive help after the lesson and the entry in the action dock so tutoring does not displace the course opening.
export const LearningTutorSlot = createContext<{ body?: ReactNode; footer?: ReactNode } | null>(null);
