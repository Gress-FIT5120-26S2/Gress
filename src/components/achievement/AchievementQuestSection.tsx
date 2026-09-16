import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { FridgeQuestAssignment, QuestCode } from '../../services/achievementApi';

type QuestCopy = {
  title: string; daily: string; weekly: string; empty: string; completed: string;
  progressOf: (current: number, total: number) => string; reward: (xp: number) => string;
  endsAt: (time: string) => string; reroll: string; rerolling: string;
  items: Record<QuestCode, string>; descriptions: Record<QuestCode, string>;
};

type Props = {
  copy: QuestCopy; daily: FridgeQuestAssignment[]; weekly: FridgeQuestAssignment[];
  dailyRerollsRemaining: number; weeklyRerollsRemaining: number; rerollingAssignmentUid: string | null;
  onReroll: (assignment: FridgeQuestAssignment) => void; formatEndsAt: (iso: string) => string;
};

// Arthur: NarIyirm
// 中文：挑战首页只保留任务、进度和奖励；说明与更换操作下沉到详情弹层，降低文字噪音。
// EN: The overview keeps task, progress, and reward; explanations and rerolls move into a detail sheet to reduce text noise.
export function AchievementQuestSection({ copy, daily, weekly, dailyRerollsRemaining, weeklyRerollsRemaining, rerollingAssignmentUid, onReroll, formatEndsAt }: Props) {
  const [selected, setSelected] = useState<FridgeQuestAssignment | null>(null);
  const [confirming, setConfirming] = useState(false);
  const all = [...daily, ...weekly];
  const completed = all.filter((item) => item.status === 'completed').length;
  const rerolls = selected?.periodType === 'daily' ? dailyRerollsRemaining : weeklyRerollsRemaining;
  return <View style={styles.card}>
    {/* Arthur: NarIyirm */}
    {/* 中文：总完成计数去掉 Completed 文案，并与 Daily 标题同一行对齐，避免和区块标题抢视觉重心。 */}
    {/* EN: Drop the Completed label and keep the total count on the Daily heading row so it does not compete with the section title. */}
    <View style={styles.header}><Text style={styles.eyebrow}>TODAY · THIS WEEK</Text><Text style={styles.title}>{copy.title}</Text></View>
    <QuestGroup copy={copy} countLabel={`${completed}/${all.length}`} items={daily} label={copy.daily} onSelect={setSelected} />
    <QuestGroup copy={copy} items={weekly} label={copy.weekly} onSelect={setSelected} />
    <Modal animationType="slide" onRequestClose={() => { setSelected(null); setConfirming(false); }} presentationStyle="pageSheet" visible={selected !== null}>
      {selected ? <ScrollView contentContainerStyle={styles.sheet}>
        <View style={styles.sheetHandle} />
        <View style={styles.sheetTop}><Text style={styles.period}>{selected.periodType === 'daily' ? copy.daily : copy.weekly}</Text><Pressable accessibilityRole="button" onPress={() => { setSelected(null); setConfirming(false); }} style={styles.close}><Ionicons color="#456158" name="close" size={22} /></Pressable></View>
        <View style={[styles.heroIcon, selected.status === 'completed' && styles.heroIconDone]}><Ionicons color={selected.status === 'completed' ? '#FFFFFF' : '#2A8A61'} name={selected.status === 'completed' ? 'checkmark' : 'leaf-outline'} size={30} /></View>
        <Text style={styles.sheetTitle}>{copy.items[selected.questCode]}</Text>
        <Text style={styles.sheetDescription}>{copy.descriptions[selected.questCode]}</Text>
        <QuestProgress copy={copy} quest={selected} large />
        <View style={styles.infoRow}><Ionicons color="#789087" name="time-outline" size={18} /><Text style={styles.infoText}>{copy.endsAt(formatEndsAt(selected.periodEnd))}</Text></View>
        <View style={styles.infoRow}><Ionicons color="#C16A2B" name="sparkles-outline" size={18} /><Text style={styles.reward}>{copy.reward(selected.rewardXp)}</Text></View>
        {selected.status === 'assigned' && !confirming ? <Pressable accessibilityRole="button" disabled={!selected.canReroll || rerolls <= 0 || rerollingAssignmentUid !== null} onPress={() => setConfirming(true)} style={({ pressed }) => [styles.reroll, (!selected.canReroll || rerolls <= 0) && styles.disabled, pressed && styles.pressed]}><Ionicons color="#2A8A61" name="refresh-outline" size={18} /><Text style={styles.rerollText}>{rerollingAssignmentUid === selected.assignmentUid ? copy.rerolling : `${copy.reroll} · ${rerolls}/3`}</Text></Pressable> : null}
        {confirming ? <View style={styles.confirm}><Text style={styles.confirmTitle}>{copy.daily.includes('今日') ? '确认更换任务？' : 'Change this task?'}</Text><Text style={styles.confirmBody}>{copy.daily.includes('今日') ? '系统会从适合当前库存的任务中选择一个，本任务进度不会保留。' : 'A new task will be selected for your current inventory. This task’s progress will not carry over.'}</Text><View style={styles.confirmActions}><Pressable onPress={() => setConfirming(false)} style={styles.cancel}><Text style={styles.cancelText}>{copy.daily.includes('今日') ? '取消' : 'Cancel'}</Text></Pressable><Pressable onPress={() => { onReroll(selected); setConfirming(false); setSelected(null); }} style={styles.confirmButton}><Text style={styles.confirmButtonText}>{copy.daily.includes('今日') ? `确认更换 · 剩余 ${rerolls} 次` : `Change · ${rerolls} left`}</Text></Pressable></View></View> : null}
      </ScrollView> : null}
    </Modal>
  </View>;
}

function QuestGroup({ copy, countLabel, items, label, onSelect }: { copy: QuestCopy; countLabel?: string; items: FridgeQuestAssignment[]; label: string; onSelect: (item: FridgeQuestAssignment) => void }) {
  const count = countLabel ?? `${items.filter((x) => x.status === 'completed').length}/${items.length}`;
  return <View style={styles.group}><View style={styles.groupHead}><Text style={styles.groupTitle}>{label}</Text><Text style={styles.groupCount}>{count}</Text></View>{items.length === 0 ? <Text style={styles.empty}>{copy.empty}</Text> : items.map((quest) => <Pressable accessibilityRole="button" key={quest.assignmentUid} onPress={() => onSelect(quest)} style={({ pressed }) => [styles.questRow, pressed && styles.pressed]}><View style={[styles.check, quest.status === 'completed' && styles.checkDone]}>{quest.status === 'completed' ? <Ionicons color="#FFFFFF" name="checkmark" size={16} /> : <Text style={styles.checkText}>{quest.slotIndex}</Text>}</View><View style={styles.questBody}><Text numberOfLines={1} style={styles.questTitle}>{copy.items[quest.questCode]}</Text><QuestProgress copy={copy} quest={quest} /></View><Text style={styles.xp}>+{quest.rewardXp}</Text><Ionicons color="#A1B0AA" name="chevron-forward" size={17} /></Pressable>)}</View>;
}

function QuestProgress({ copy, quest, large = false }: { copy: QuestCopy; quest: FridgeQuestAssignment; large?: boolean }) {
  const current = Number(quest.progressCurrent ?? 0); const target = Number(quest.progressTarget ?? quest.target ?? 1); const ratio = Math.min(1, current / Math.max(1, target));
  return <View style={large ? styles.progressLarge : styles.progress}><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.round(ratio * 100)}%` }]} /></View><Text style={styles.progressText}>{copy.progressOf(Math.min(current, target), target)}</Text></View>;
}

const styles = StyleSheet.create({
  card:{marginTop:18,padding:18,borderRadius:22,borderCurve:'continuous',backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#E3EEE9'},header:{marginBottom:18},eyebrow:{color:'#8A9A93',fontSize:9,fontWeight:'900',letterSpacing:1.1},title:{marginTop:4,color:'#173D31',fontSize:19,fontWeight:'900'},group:{marginTop:8},groupHead:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:7},groupTitle:{color:'#5E756D',fontSize:12,fontWeight:'900'},groupCount:{color:'#2A8A61',fontSize:12,fontWeight:'900'},empty:{paddingVertical:14,color:'#789087',fontSize:12},questRow:{minHeight:70,flexDirection:'row',alignItems:'center',gap:10,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:'#E4ECE8'},check:{width:30,height:30,borderRadius:15,alignItems:'center',justifyContent:'center',backgroundColor:'#EDF4F1'},checkDone:{backgroundColor:'#2A8A61'},checkText:{color:'#789087',fontSize:11,fontWeight:'900'},questBody:{flex:1,minWidth:0},questTitle:{color:'#173D31',fontSize:13,fontWeight:'800'},progress:{marginTop:7,flexDirection:'row',alignItems:'center',gap:8},progressLarge:{marginTop:26,gap:10},progressTrack:{height:6,flex:1,borderRadius:99,backgroundColor:'#E7F0EC',overflow:'hidden'},progressFill:{height:'100%',borderRadius:99,backgroundColor:'#55A77F'},progressText:{color:'#789087',fontSize:10,fontWeight:'700'},xp:{color:'#C16A2B',fontSize:11,fontWeight:'900'},pressed:{opacity:.72},sheet:{flexGrow:1,paddingHorizontal:24,paddingBottom:40,backgroundColor:'#F7FBFA'},sheetHandle:{alignSelf:'center',width:42,height:5,borderRadius:3,backgroundColor:'#D7E3DE',marginTop:10,marginBottom:20},sheetTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},period:{color:'#789087',fontSize:12,fontWeight:'900',letterSpacing:.6,textTransform:'uppercase'},close:{width:40,height:40,borderRadius:20,alignItems:'center',justifyContent:'center',backgroundColor:'#EAF2EF'},heroIcon:{marginTop:34,width:68,height:68,borderRadius:34,alignItems:'center',justifyContent:'center',backgroundColor:'#E2F2E9'},heroIconDone:{backgroundColor:'#2A8A61'},sheetTitle:{marginTop:20,color:'#173D31',fontSize:28,fontWeight:'900'},sheetDescription:{marginTop:12,color:'#5E756D',fontSize:15,fontWeight:'600',lineHeight:23},infoRow:{marginTop:20,flexDirection:'row',alignItems:'center',gap:10},infoText:{color:'#5E756D',fontSize:13,fontWeight:'700'},reward:{color:'#C16A2B',fontSize:14,fontWeight:'900'},reroll:{marginTop:32,minHeight:52,borderRadius:16,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,backgroundColor:'#E4F3EA'},rerollText:{color:'#2A8A61',fontSize:14,fontWeight:'900'},disabled:{opacity:.42},confirm:{marginTop:28,padding:18,borderRadius:18,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#DCE9E3'},confirmTitle:{color:'#173D31',fontSize:17,fontWeight:'900'},confirmBody:{marginTop:8,color:'#667B72',fontSize:12.5,lineHeight:19,fontWeight:'600'},confirmActions:{marginTop:18,flexDirection:'row',gap:10},cancel:{flex:1,minHeight:46,alignItems:'center',justifyContent:'center',borderRadius:14,backgroundColor:'#EDF2F0'},cancelText:{color:'#62766E',fontSize:13,fontWeight:'800'},confirmButton:{flex:2,minHeight:46,alignItems:'center',justifyContent:'center',borderRadius:14,backgroundColor:'#315F4F'},confirmButtonText:{color:'#FFFFFF',fontSize:13,fontWeight:'900'},
});
