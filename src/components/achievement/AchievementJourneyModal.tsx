import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import type { AchievementCode, AchievementDashboard } from '../../services/achievementApi';
import { EdgeSwipeBackView } from '../navigation/EdgeSwipeBackView';

// Arthur: NarIyirm
// 中文：每项成就绑定独立的自然浮雕奖牌资源，避免奖牌馆退化为通用线性图标。
// EN: Each achievement maps to its own nature-relief medal asset so the collection never falls back to generic line icons.
const MEDAL_ASSETS: Record<AchievementCode, number> = {
  first_item: require('../../assets/achievements/medals/first-item.png'),
  first_rescue: require('../../assets/achievements/medals/first-rescue.png'),
  waste_watcher: require('../../assets/achievements/medals/waste-aware.png'),
  zero_waste_week: require('../../assets/achievements/medals/zero-waste-week.png'),
  rescue_ten: require('../../assets/achievements/medals/rescue-ten.png'),
  fridge_regular: require('../../assets/achievements/medals/fridge-regular.png'),
  shared_kitchen: require('../../assets/achievements/medals/shared-kitchen.png'),
  climate_summit: require('../../assets/achievements/medals/climate-summit.png'),
};

const TRAIL_STEP_HEIGHT = 148;

type Props = { visible: boolean; initialTab: 'journey'|'medals'; onClose: () => void; dashboard: AchievementDashboard; language: 'zh' | 'en'; badgeCopy: { items: Record<AchievementCode,string>; descriptions: Record<AchievementCode,string>; unlocked: string; locked: string; inProgress: string; reward: (xp:number)=>string; journey: { ascent:string; checkpoints:(earned:number,total:number)=>string; summitReached:string; nextCamp:string; baseCamp:string; camp:(index:number)=>string; summit:string; explore:string } } };

// Arthur: NarIyirm
// 中文：成长路径与奖牌馆共用同一全屏层级，保持山路叙事但用留白和克制色彩维持成熟会员中心的清晰度。
// EN: The journey and medal collection share one full-screen layer, retaining the mountain-path story with restrained colour and member-centre clarity.
export function AchievementJourneyModal({ visible, initialTab, onClose, dashboard, language, badgeCopy }: Props) {
  const [tab,setTab]=useState<'journey'|'medals'>('journey');
  const [filter,setFilter]=useState<'all'|'earned'|'locked'>('all');
  const [focused,setFocused]=useState<AchievementDashboard['achievements'][number]|null>(null);
  const scrollRef=useRef<ScrollView>(null);
  const zh=language==='zh';
  const achievements=dashboard.achievements.filter((x)=>x.status!=='unavailable').filter((x)=>filter==='all'||(filter==='earned'?x.status==='unlocked':x.status!=='unlocked'));
  const journeyItems=dashboard.achievements.filter((item)=>item.status!=='unavailable');
  const earnedCount=journeyItems.filter((item)=>item.status==='unlocked').length;
  const currentJourneyIndex=journeyItems.findIndex((item)=>item.status!=='unlocked');
  const nextCamp=currentJourneyIndex>=0?journeyItems[currentJourneyIndex]:null;
  const journeyProgress=journeyItems.length===0?0:earnedCount/journeyItems.length;
  useEffect(()=>{if(visible){setTab(initialTab);setFilter('all');setFocused(null);}},[initialTab,visible]);
  // Arthur: NarIyirm
  // 中文：营地采用固定节奏布局，直接按索引定位，避免异步读取已被回收的布局事件。
  // EN: Camps use a fixed vertical rhythm, so index-based positioning avoids reading a recycled layout event asynchronously.
  const scrollToCurrentMilestone = (index: number) => {
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: Math.max(0, index*TRAIL_STEP_HEIGHT+70), animated: false }));
  };
  return <Modal animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen" visible={visible}>
    <EdgeSwipeBackView onBack={onClose}><SafeAreaView edges={['top','bottom']} style={styles.root}><StatusBar style="dark" /><View style={styles.nav}><Pressable accessibilityRole="button" hitSlop={12} onPress={onClose} style={styles.navButton}><Ionicons color="#294A40" name="chevron-back" size={23}/></Pressable><Text style={styles.navTitle}>{zh?'环保里程碑':'Eco milestones'}</Text><View style={styles.navButton}/></View>
    <View style={styles.tabs}><Pressable onPress={()=>setTab('journey')} style={[styles.tab,tab==='journey'&&styles.tabActive]}><Text style={[styles.tabText,tab==='journey'&&styles.tabTextActive]}>{zh?'成长路径':'Journey'}</Text></Pressable><Pressable onPress={()=>setTab('medals')} style={[styles.tab,tab==='medals'&&styles.tabActive]}><Text style={[styles.tabText,tab==='medals'&&styles.tabTextActive]}>{zh?'奖牌馆':'Medals'}</Text></Pressable></View>
    {tab==='journey'?<ScrollView ref={scrollRef} contentContainerStyle={journeyStyles.journey} showsVerticalScrollIndicator={false}>
      <View style={journeyStyles.ascentSummary}>
        <View style={journeyStyles.ascentTopRow}>
          <View style={journeyStyles.ascentCopy}>
            <Text style={journeyStyles.ascentLabel}>{badgeCopy.journey.ascent}</Text>
            <Text style={journeyStyles.ascentValue}>{earnedCount}<Text style={journeyStyles.ascentTotal}> / {journeyItems.length}</Text></Text>
            <Text style={journeyStyles.ascentCaption}>{badgeCopy.journey.checkpoints(earnedCount,journeyItems.length)}</Text>
          </View>
          <View style={journeyStyles.summitSeal}>
            <Ionicons color="#F5D6A1" name={nextCamp?'flag-outline':'flag'} size={25}/>
            <Text style={journeyStyles.summitSealLevel}>LV.{dashboard.level.current}</Text>
          </View>
        </View>
        <View style={journeyStyles.ascentTrack}><View style={[journeyStyles.ascentTrackFill,{width:`${journeyProgress*100}%`}]}/></View>
        <View style={journeyStyles.nextCampRow}>
          <Text style={journeyStyles.nextCampLabel}>{nextCamp?badgeCopy.journey.nextCamp:badgeCopy.journey.summitReached}</Text>
          <Text numberOfLines={1} style={journeyStyles.nextCampName}>{nextCamp?badgeCopy.items[nextCamp.code]:`${dashboard.level.totalXp} XP`}</Text>
        </View>
      </View>

      {/* Arthur: NarIyirm
          中文：路线用一段段可着色的贝塞尔曲线连接营地，让完成、当前攀登和未解锁状态形成连续的登顶方向。
          EN: Segment-coloured Bezier paths connect each camp so completed, current ascent, and locked states read as one continuous climb. */}
      <View style={[journeyStyles.trailMap,{height:journeyItems.length*TRAIL_STEP_HEIGHT}]}>
        <Svg height="100%" pointerEvents="none" preserveAspectRatio="none" style={journeyStyles.trailSvg} viewBox={`0 0 360 ${journeyItems.length*TRAIL_STEP_HEIGHT}`} width="100%">
          {journeyItems.slice(0,-1).map((_,index)=>{
            const startX=index%2===0?34:326;
            const endX=index%2===0?326:34;
            const startY=index*TRAIL_STEP_HEIGHT+47;
            const endY=(index+1)*TRAIL_STEP_HEIGHT+47;
            const path=`M ${startX} ${startY} C ${startX} ${startY+74}, ${endX} ${endY-74}, ${endX} ${endY}`;
            const completed=journeyItems[index+1].status==='unlocked';
            const approaching=index+1===currentJourneyIndex;
            return <Path key={`trail-${index}`} d={path} fill="none" stroke={completed?'#5D8D73':approaching?'#C69249':'#D9E2DD'} strokeDasharray={approaching?'8 8':undefined} strokeLinecap="round" strokeWidth={completed?5:4}/>;
          })}
        </Svg>
        {journeyItems.map((item,index)=>{
          const current=index===currentJourneyIndex;
          const reached=item.status==='unlocked';
          const summit=index===journeyItems.length-1;
          const ratio=item.progressTarget>0?Math.min(1,item.progressCurrent/item.progressTarget):0;
          const stage=summit?badgeCopy.journey.summit:index===0?badgeCopy.journey.baseCamp:badgeCopy.journey.camp(index+1);
          return <View key={item.code} onLayout={current?()=>scrollToCurrentMilestone(index):undefined} style={[journeyStyles.trailStop,{top:index*TRAIL_STEP_HEIGHT},index%2!==0&&journeyStyles.trailStopReverse]}>
            <View style={[journeyStyles.campNode,reached&&journeyStyles.campNodeReached,current&&journeyStyles.campNodeCurrent,summit&&journeyStyles.campNodeSummit]}>
              {reached?<Ionicons color="#FFFFFF" name="checkmark" size={20}/>:summit?<Ionicons color={current?'#243F35':'#788780'} name="flag" size={18}/>:<Text style={[journeyStyles.campNodeNumber,current&&journeyStyles.campNodeNumberCurrent]}>{index+1}</Text>}
            </View>
            <Pressable accessibilityRole="button" onPress={()=>setFocused(item)} style={({pressed})=>[journeyStyles.trailCard,current&&journeyStyles.trailCardCurrent,summit&&journeyStyles.trailCardSummit,pressed&&styles.pressed]}>
              <View style={journeyStyles.trailCardHeading}>
                <Text style={[journeyStyles.stageLabel,current&&journeyStyles.stageLabelCurrent]}>{stage}</Text>
                <Text style={[journeyStyles.stageStatus,reached&&journeyStyles.stageStatusReached,current&&journeyStyles.stageStatusCurrent]}>{reached?badgeCopy.unlocked:current?badgeCopy.inProgress:badgeCopy.locked}</Text>
              </View>
              <Text numberOfLines={1} style={journeyStyles.trailName}>{badgeCopy.items[item.code]}</Text>
              {current?<View style={journeyStyles.campProgressTrack}><View style={[journeyStyles.campProgressFill,{width:`${ratio*100}%`}]}/></View>:null}
              <View style={journeyStyles.trailMetaRow}>
                <Text numberOfLines={1} style={journeyStyles.trailHint}>{current&&item.progressTarget>0?`${Math.floor(item.progressCurrent)}/${Math.floor(item.progressTarget)}`:badgeCopy.journey.explore}</Text>
                <Text style={journeyStyles.trailReward}>{badgeCopy.reward(item.xpReward)}</Text>
              </View>
            </Pressable>
          </View>;
        })}
      </View>
    </ScrollView>:<ScrollView contentContainerStyle={styles.medalPage} showsVerticalScrollIndicator={false}><View style={styles.filters}>{(['all','earned','locked'] as const).map((item)=><Pressable key={item} onPress={()=>setFilter(item)} style={[styles.filter,filter===item&&styles.filterActive]}><Text style={[styles.filterText,filter===item&&styles.filterTextActive]}>{item==='all'?(zh?'全部':'All'):item==='earned'?(zh?'已获得':'Earned'):(zh?'未获得':'Locked')}</Text></Pressable>)}</View><View style={styles.medalGrid}>{achievements.map((item)=><Pressable key={item.code} onPress={()=>setFocused(item)} style={({pressed})=>[styles.medalCell,pressed&&styles.pressed]}><Medal code={item.code} earned={item.status==='unlocked'}/><Text numberOfLines={2} style={[styles.medalName,item.status!=='unlocked'&&styles.muted]}>{badgeCopy.items[item.code]}</Text><Text style={styles.medalState}>{item.status==='unlocked'?badgeCopy.unlocked:item.status==='in_progress'?`${Math.floor(item.progressCurrent)}/${Math.floor(item.progressTarget)}`:badgeCopy.locked}</Text></Pressable>)}</View></ScrollView>}
    {focused?<View style={styles.detailScrim}><Pressable onPress={()=>setFocused(null)} style={StyleSheet.absoluteFill}/><View style={styles.detail}><Medal code={focused.code} earned={focused.status==='unlocked'} large/><Text style={styles.detailTitle}>{badgeCopy.items[focused.code]}</Text><Text style={styles.detailBody}>{badgeCopy.descriptions[focused.code]}</Text><Text style={styles.detailReward}>{badgeCopy.reward(focused.xpReward)}</Text><Pressable onPress={()=>setFocused(null)} style={styles.done}><Text style={styles.doneText}>{zh?'收起':'Done'}</Text></Pressable></View></View>:null}</SafeAreaView></EdgeSwipeBackView>
  </Modal>;
}

// Arthur: NarIyirm
// 中文：未获得奖牌仍展示真实造型，用轻雾遮罩和小锁区分状态，避免用户看不到未来奖励的设计。
// EN: Locked medals retain their real artwork, using a mist veil and small lock to distinguish state without hiding future rewards.
export function Medal({code,earned,large=false}:{code:AchievementCode;earned:boolean;large?:boolean}) {
  const size=large?178:112;
  return <View style={[styles.medalArtwork,{width:size,height:size}]}>
    <Image contentFit="contain" source={MEDAL_ASSETS[code]} style={[StyleSheet.absoluteFill,!earned&&styles.medalImageLocked]}/>
    {!earned?<View style={styles.medalLockVeil}><View style={[styles.medalLock,large&&styles.medalLockLarge]}><Ionicons color="#53665E" name="lock-closed" size={large?20:14}/></View></View>:null}
  </View>;
}

const journeyStyles=StyleSheet.create({
  journey:{paddingHorizontal:16,paddingTop:4,paddingBottom:70},
  ascentSummary:{marginBottom:12,padding:18,borderRadius:16,backgroundColor:'#183F33',overflow:'hidden'},
  ascentTopRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  ascentCopy:{flex:1,paddingRight:14},
  ascentLabel:{color:'#C8DCD2',fontSize:13,fontWeight:'700'},
  ascentValue:{marginTop:2,color:'#FFFFFF',fontSize:40,fontWeight:'900',letterSpacing:-1},
  ascentTotal:{color:'#AFC8BC',fontSize:20,fontWeight:'700'},
  ascentCaption:{marginTop:2,color:'#D6E4DD',fontSize:12,fontWeight:'600'},
  summitSeal:{width:72,height:72,borderRadius:36,alignItems:'center',justifyContent:'center',backgroundColor:'#285A49',borderWidth:1,borderColor:'#5E8576'},
  summitSealLevel:{marginTop:4,color:'#DCEAE3',fontSize:9,fontWeight:'900',letterSpacing:.8},
  ascentTrack:{height:6,marginTop:17,borderRadius:3,backgroundColor:'#315B4D',overflow:'hidden'},
  ascentTrackFill:{height:'100%',borderRadius:3,backgroundColor:'#E1B568'},
  nextCampRow:{marginTop:13,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10},
  nextCampLabel:{color:'#AFC8BC',fontSize:11,fontWeight:'700'},
  nextCampName:{flexShrink:1,color:'#FFFFFF',fontSize:12,fontWeight:'800',textAlign:'right'},
  trailMap:{position:'relative',alignSelf:'center',width:'100%',maxWidth:420,marginTop:4},
  trailSvg:{position:'absolute',top:0,right:0,bottom:0,left:0},
  trailStop:{position:'absolute',right:0,left:0,height:TRAIL_STEP_HEIGHT,flexDirection:'row',alignItems:'flex-start',gap:12,paddingHorizontal:4},
  trailStopReverse:{flexDirection:'row-reverse'},
  campNode:{zIndex:2,width:60,height:60,marginTop:17,borderRadius:30,alignItems:'center',justifyContent:'center',backgroundColor:'#EEF2EF',borderWidth:5,borderColor:'#F5F8F6'},
  campNodeReached:{backgroundColor:'#4D8067'},
  campNodeCurrent:{backgroundColor:'#E3B56A',borderColor:'#FBF0DC'},
  campNodeSummit:{borderWidth:4,borderColor:'#D6C39F'},
  campNodeNumber:{color:'#66776F',fontSize:14,fontWeight:'900'},
  campNodeNumberCurrent:{color:'#263F36'},
  trailCard:{flex:1,minHeight:112,padding:14,borderRadius:14,backgroundColor:'#FFFFFF'},
  trailCardCurrent:{borderWidth:1,borderColor:'#D7A456',backgroundColor:'#FFFCF6'},
  trailCardSummit:{backgroundColor:'#EDF2EE'},
  trailCardHeading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},
  stageLabel:{color:'#657970',fontSize:10,fontWeight:'800',letterSpacing:.5},
  stageLabelCurrent:{color:'#815322'},
  stageStatus:{color:'#667970',fontSize:9.5,fontWeight:'700'},
  stageStatusReached:{color:'#31694F'},
  stageStatusCurrent:{color:'#92581F'},
  trailName:{marginTop:7,color:'#1E4638',fontSize:16,fontWeight:'900'},
  trailMetaRow:{marginTop:8,flexDirection:'row',alignItems:'center',gap:7},
  trailReward:{color:'#79562F',fontSize:10.5,fontWeight:'800'},
  trailDot:{width:3,height:3,borderRadius:2,backgroundColor:'#82958C'},
  trailHint:{flex:1,color:'#52675D',fontSize:9.5,fontWeight:'600'},
  campProgressTrack:{height:4,marginTop:10,borderRadius:2,backgroundColor:'#E9E4DB',overflow:'hidden'},
  campProgressFill:{height:'100%',borderRadius:2,backgroundColor:'#C88E43'},
});

const styles=StyleSheet.create({root:{flex:1,backgroundColor:'#F5F8F6'},nav:{height:58,paddingHorizontal:12,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#DCE6E1'},navButton:{width:44,height:44,alignItems:'center',justifyContent:'center'},navTitle:{color:'#173D31',fontSize:17,fontWeight:'900'},tabs:{margin:14,padding:4,flexDirection:'row',backgroundColor:'#E8EFEB',borderRadius:14},tab:{flex:1,minHeight:38,alignItems:'center',justifyContent:'center',borderRadius:11},tabActive:{backgroundColor:'#FFFFFF'},tabText:{color:'#71847C',fontSize:13,fontWeight:'800'},tabTextActive:{color:'#244C3E'},journey:{padding:18,paddingBottom:80},summary:{padding:22,borderRadius:24,backgroundColor:'#E4EFE9'},summaryLabel:{color:'#6F817A',fontSize:10,fontWeight:'900',letterSpacing:1},summaryValue:{marginTop:6,color:'#214D3E',fontSize:38,fontWeight:'900'},summaryUnit:{fontSize:15},summaryCaption:{marginTop:8,color:'#60776E',fontSize:13,lineHeight:19,fontWeight:'600'},pathLine:{position:'absolute',top:180,bottom:60,left:'50%',width:2,backgroundColor:'#D8E4DE'},stop:{minHeight:150,width:'87%',flexDirection:'row',alignItems:'center',gap:13,zIndex:1},stopLeft:{alignSelf:'flex-start'},stopRight:{alignSelf:'flex-end',flexDirection:'row-reverse'},node:{width:48,height:48,borderRadius:24,alignItems:'center',justifyContent:'center',backgroundColor:'#EDF1EF',borderWidth:2,borderColor:'#D3DDD8'},nodeReached:{backgroundColor:'#DDEBE3',borderColor:'#7DA28D'},nodeCurrent:{width:58,height:58,borderRadius:29,backgroundColor:'#3C8064',borderColor:'#B9D6C6',borderWidth:5},nodeNumber:{color:'#9BA8A3',fontSize:14,fontWeight:'900'},nodeNumberCurrent:{color:'#FFFFFF'},levelCard:{flex:1,padding:15,borderRadius:18,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#E1EAE6'},levelCardCurrent:{borderColor:'#94BCA8',backgroundColor:'#FBFDFC'},levelNo:{color:'#7B8D85',fontSize:9,fontWeight:'900',letterSpacing:.8},levelName:{marginTop:5,color:'#264B40',fontSize:16,fontWeight:'900'},levelDescription:{marginTop:5,color:'#71847C',fontSize:10.5,fontWeight:'600',lineHeight:15},levelXp:{marginTop:5,color:'#8A6A42',fontSize:11,fontWeight:'800'},medalPage:{padding:18,paddingBottom:70},filters:{flexDirection:'row',gap:8,marginBottom:20},filter:{paddingHorizontal:16,minHeight:36,alignItems:'center',justifyContent:'center',borderRadius:18,backgroundColor:'#E8EFEB'},filterActive:{backgroundColor:'#315F4F'},filterText:{color:'#657970',fontSize:12,fontWeight:'800'},filterTextActive:{color:'#FFFFFF'},medalGrid:{flexDirection:'row',flexWrap:'wrap',gap:12},medalCell:{width:'47%',flexGrow:1,alignItems:'center',paddingVertical:18,paddingHorizontal:8,borderRadius:20,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#E3EAE7'},pressed:{opacity:.75,transform:[{scale:.98}]},medalArtwork:{alignItems:'center',justifyContent:'center'},medalImageLocked:{opacity:.38},medalLockVeil:{position:'absolute',top:0,right:0,bottom:0,left:0,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(245,248,246,.2)',borderRadius:999},medalLock:{width:30,height:30,borderRadius:15,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(250,252,251,.92)',borderWidth:1,borderColor:'rgba(83,102,94,.18)'},medalLockLarge:{width:42,height:42,borderRadius:21},medalName:{marginTop:8,color:'#244C3E',fontSize:13,fontWeight:'900',textAlign:'center'},muted:{color:'#7E8D87'},medalState:{marginTop:5,color:'#8A9A93',fontSize:10,fontWeight:'700'},detailScrim:{position:'absolute',top:0,right:0,bottom:0,left:0,backgroundColor:'rgba(18,39,32,.42)',justifyContent:'flex-end'},detail:{alignItems:'center',padding:28,paddingBottom:34,borderTopLeftRadius:28,borderTopRightRadius:28,backgroundColor:'#FAFCFB'},detailTitle:{marginTop:12,color:'#173D31',fontSize:24,fontWeight:'900'},detailBody:{marginTop:10,color:'#60756D',fontSize:14,lineHeight:21,textAlign:'center'},detailReward:{marginTop:14,color:'#A1683A',fontSize:13,fontWeight:'900'},done:{marginTop:22,minHeight:48,alignSelf:'stretch',alignItems:'center',justifyContent:'center',borderRadius:15,backgroundColor:'#315F4F'},doneText:{color:'#FFFFFF',fontSize:14,fontWeight:'900'}});
