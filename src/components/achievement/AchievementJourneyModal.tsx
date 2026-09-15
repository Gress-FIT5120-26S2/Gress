import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BlurTargetView, BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { AccessibilityInfo, Animated, Easing, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

export type BadgeCopy = { items: Record<AchievementCode,string>; descriptions: Record<AchievementCode,string>; unlocked: string; locked: string; inProgress: string; reward: (xp:number)=>string; releaseHint:string; rotateHint:string; frontSide:string; backSide:string; journey: { ascent:string; checkpoints:(earned:number,total:number)=>string; summitReached:string; nextCamp:string; baseCamp:string; camp:(index:number)=>string; summit:string; explore:string }; wall:{title:string;open:string;settings:string;collection:string;count:(earned:number,total:number)=>string;emptyTitle:string;emptyBody:string;chooseBoard:string;chooseHint:string;selected:string;useBoard:string;themes:{cloudStone:string;cedarRidge:string;nightSummit:string}} };
type Props = { visible: boolean; initialTab: 'journey'|'medals'; onClose: () => void; dashboard: AchievementDashboard; language: 'zh' | 'en'; badgeCopy: BadgeCopy };

// Arthur: NarIyirm
// 中文：成长路径与奖牌馆共用同一全屏层级，保持山路叙事但用留白和克制色彩维持成熟会员中心的清晰度。
// EN: The journey and medal collection share one full-screen layer, retaining the mountain-path story with restrained colour and member-centre clarity.
export function AchievementJourneyModal({ visible, initialTab, onClose, dashboard, language, badgeCopy }: Props) {
  const insets=useSafeAreaInsets();
  const [tab,setTab]=useState<'journey'|'medals'>(initialTab);
  const [filter,setFilter]=useState<'all'|'earned'|'locked'>('all');
  const [focused,setFocused]=useState<AchievementDashboard['achievements'][number]|null>(null);
  const scrollRef=useRef<ScrollView>(null);
  const blurTargetRef=useRef<View|null>(null);
  const zh=language==='zh';
  const achievements=dashboard.achievements.filter((x)=>x.status!=='unavailable').filter((x)=>filter==='all'||(filter==='earned'?x.status==='unlocked':x.status!=='unlocked'));
  const journeyItems=dashboard.achievements.filter((item)=>item.status!=='unavailable');
  const earnedCount=journeyItems.filter((item)=>item.status==='unlocked').length;
  const currentJourneyIndex=journeyItems.findIndex((item)=>item.status!=='unlocked');
  const nextCamp=currentJourneyIndex>=0?journeyItems[currentJourneyIndex]:null;
  const journeyProgress=journeyItems.length===0?0:earnedCount/journeyItems.length;
  useEffect(()=>{if(visible){setTab(initialTab);setFilter('all');setFocused(null);}},[initialTab,visible]);
  const openAchievement = (item: AchievementDashboard['achievements'][number]) => {
    setFocused(item);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(()=>undefined);
  };
  // Arthur: NarIyirm
  // 中文：营地采用固定节奏布局，直接按索引定位，避免异步读取已被回收的布局事件。
  // EN: Camps use a fixed vertical rhythm, so index-based positioning avoids reading a recycled layout event asynchronously.
  const scrollToCurrentMilestone = (index: number) => {
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: Math.max(0, index*TRAIL_STEP_HEIGHT+70), animated: false }));
  };
  return <Modal animationType="slide" onRequestClose={focused?()=>setFocused(null):onClose} presentationStyle="fullScreen" visible={visible}>
    <EdgeSwipeBackView enabled={!focused} onBack={onClose}><View style={[styles.root,{paddingTop:Math.max(insets.top,12),paddingBottom:insets.bottom}]}><StatusBar style="dark" /><BlurTargetView ref={blurTargetRef} style={styles.blurTarget}><View style={styles.nav}><Pressable accessibilityRole="button" hitSlop={12} onPress={onClose} style={styles.navButton}><Ionicons color="#294A40" name="chevron-back" size={23}/></Pressable><Text style={styles.navTitle}>{zh?'环保里程碑':'Eco milestones'}</Text><View style={styles.navButton}/></View>
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
            <Pressable accessibilityRole="button" onPress={()=>openAchievement(item)} style={({pressed})=>[journeyStyles.trailCard,current&&journeyStyles.trailCardCurrent,summit&&journeyStyles.trailCardSummit,pressed&&styles.pressed]}>
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
    </ScrollView>:<ScrollView contentContainerStyle={styles.medalPage} showsVerticalScrollIndicator={false}><View style={styles.filters}>{(['all','earned','locked'] as const).map((item)=><Pressable key={item} onPress={()=>setFilter(item)} style={[styles.filter,filter===item&&styles.filterActive]}><Text style={[styles.filterText,filter===item&&styles.filterTextActive]}>{item==='all'?(zh?'全部':'All'):item==='earned'?(zh?'已获得':'Earned'):(zh?'未获得':'Locked')}</Text></Pressable>)}</View><View style={styles.medalGrid}>{achievements.map((item)=><Pressable key={item.code} onPress={()=>openAchievement(item)} style={({pressed})=>[styles.medalCell,pressed&&styles.pressed]}><Medal code={item.code} earned={item.status==='unlocked'}/><Text numberOfLines={2} style={[styles.medalName,item.status!=='unlocked'&&styles.muted]}>{badgeCopy.items[item.code]}</Text><Text style={styles.medalState}>{item.status==='unlocked'?badgeCopy.unlocked:item.status==='in_progress'?`${Math.floor(item.progressCurrent)}/${Math.floor(item.progressTarget)}`:badgeCopy.locked}</Text></Pressable>)}</View></ScrollView>}
    </BlurTargetView>{focused?<MedalRevealDetail achievement={focused} badgeCopy={badgeCopy} blurTarget={blurTargetRef} onClose={()=>setFocused(null)}/>:null}</View></EdgeSwipeBackView>
  </Modal>;
}

// Arthur: NarIyirm
// 中文：未获得奖牌仍展示真实造型，用轻雾遮罩和小锁区分状态，避免用户看不到未来奖励的设计。
// EN: Locked medals retain their real artwork, using a mist veil and small lock to distinguish state without hiding future rewards.
export function Medal({code,earned,large=false,size:requestedSize}:{code:AchievementCode;earned:boolean;large?:boolean;size?:number}) {
  const size=requestedSize??(large?178:112);
  return <View style={[styles.medalArtwork,{width:size,height:size}]}>
    <Image contentFit="contain" source={MEDAL_ASSETS[code]} style={[StyleSheet.absoluteFill,!earned&&styles.medalImageLocked]}/>
    {!earned?<View style={styles.medalLockVeil}><View style={[styles.medalLock,large&&styles.medalLockLarge]}><Ionicons color="#53665E" name="lock-closed" size={large?20:14}/></View></View>:null}
  </View>;
}

// Arthur: NarIyirm
// 中文：奖牌详情以一次克制的揭幕动画呈现；仅驱动透明度和变换，并在减少动态效果开启时直接淡入。
// EN: Medal details use one restrained reveal; only opacity and transforms animate, with a simple fade when reduced motion is enabled.
export function MedalRevealDetail({achievement,badgeCopy,blurTarget,onClose}:{achievement:AchievementDashboard['achievements'][number];badgeCopy:BadgeCopy;blurTarget?:RefObject<View|null>;onClose:()=>void}) {
  const insets=useSafeAreaInsets();
  const backdrop=useRef(new Animated.Value(0)).current;
  const layer=useRef(new Animated.Value(0)).current;
  const medal=useRef(new Animated.Value(0)).current;
  const copy=useRef(new Animated.Value(0)).current;
  const rotation=useRef(new Animated.Value(0)).current;
  const rotationSnapshot=useRef(0);
  const gestureStart=useRef(0);
  const closing=useRef(false);
  const reducedMotion=useRef(true);
  const [side,setSide]=useState<'front'|'back'>('front');

  // Arthur: NarIyirm
  // 中文：缓存原生驱动动画的最新角度，让下一次按下无需等待 stopAnimation 回调即可立即接管旋转。
  // EN: Cache the latest native-driven angle so the next touch can take over immediately without waiting for stopAnimation's callback.
  const rotateResponder=useMemo(()=>PanResponder.create({
    // Arthur: NarIyirm
    // 中文：奖牌在按下瞬间抢占 responder，防止全屏背景 Pressable 将后续拖动识别为关闭点击。
    // EN: The medal claims the responder on touch-down so the full-screen backdrop cannot turn the following drag into a dismiss tap.
    onStartShouldSetPanResponder:()=>true,
    onStartShouldSetPanResponderCapture:()=>true,
    onMoveShouldSetPanResponder:()=>true,
    onMoveShouldSetPanResponderCapture:()=>true,
    onPanResponderGrant:()=>{
      rotation.stopAnimation();
      gestureStart.current=rotationSnapshot.current;
    },
    onPanResponderMove:(_,gesture)=>{
      const next=gestureStart.current+gesture.dx*.72;
      rotationSnapshot.current=next;
      rotation.setValue(next);
    },
    onPanResponderRelease:(_,gesture)=>{
      const projected=gestureStart.current+gesture.dx*.72+gesture.vx*34;
      const nextSide=Math.abs(Math.round(projected/180))%2===0?'front':'back';
      setSide(nextSide);
      Animated.timing(rotation,{toValue:projected,duration:400,easing:Easing.bezier(.23,1,.32,1),useNativeDriver:true}).start();
    },
    onPanResponderTerminate:()=>rotation.stopAnimation(),
    onPanResponderTerminationRequest:()=>false,
    onShouldBlockNativeResponder:()=>true,
  }),[rotation]);

  useEffect(()=>{
    const listener=rotation.addListener(({value})=>{rotationSnapshot.current=value;});
    return()=>rotation.removeListener(listener);
  },[rotation]);

  useEffect(()=>{
    let active=true;
    let entrance: Animated.CompositeAnimation | null=null;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced)=>{
      if(!active)return;
      reducedMotion.current=reduced;
      if(reduced){rotationSnapshot.current=0;backdrop.setValue(1);layer.setValue(1);medal.setValue(1);copy.setValue(1);rotation.setValue(0);return;}
      const easeOut=Easing.bezier(.23,1,.32,1);
      const easeInOut=Easing.bezier(.77,0,.175,1);
      rotationSnapshot.current=-72;
      rotation.setValue(-72);
      entrance=Animated.parallel([
        Animated.timing(backdrop,{toValue:1,duration:180,easing:easeOut,useNativeDriver:true}),
        Animated.timing(layer,{toValue:1,duration:260,easing:easeOut,useNativeDriver:true}),
        Animated.timing(medal,{toValue:1,duration:520,easing:easeOut,useNativeDriver:true}),
        Animated.timing(copy,{toValue:1,duration:260,delay:220,easing:easeOut,useNativeDriver:true}),
        Animated.sequence([
          Animated.timing(rotation,{toValue:0,duration:520,easing:easeOut,useNativeDriver:true}),
          Animated.delay(280),
          Animated.timing(rotation,{toValue:360,duration:980,easing:easeInOut,useNativeDriver:true}),
        ]),
      ]);
      entrance.start();
    });
    return()=>{active=false;entrance?.stop();};
  },[backdrop,copy,layer,medal,rotation]);

  const close=()=>{
    if(closing.current)return;
    closing.current=true;
    if(reducedMotion.current){onClose();return;}
    Animated.parallel([
      Animated.timing(backdrop,{toValue:0,duration:130,easing:Easing.bezier(.23,1,.32,1),useNativeDriver:true}),
      Animated.timing(layer,{toValue:0,duration:170,easing:Easing.bezier(.23,1,.32,1),useNativeDriver:true}),
      Animated.timing(medal,{toValue:.82,duration:170,easing:Easing.bezier(.23,1,.32,1),useNativeDriver:true}),
      Animated.timing(copy,{toValue:0,duration:100,useNativeDriver:true}),
    ]).start(({finished})=>{if(finished)onClose();});
  };

  const layerStyle={opacity:layer};
  const medalStyle={opacity:medal,transform:[{translateY:medal.interpolate({inputRange:[0,1],outputRange:[42,0]})},{scale:medal.interpolate({inputRange:[0,1],outputRange:[.76,1]})},{rotateZ:medal.interpolate({inputRange:[0,1],outputRange:['-7deg','0deg']})}]};
  const haloStyle={opacity:medal.interpolate({inputRange:[0,.55,1],outputRange:[0,.52,0]}),transform:[{scale:medal.interpolate({inputRange:[0,1],outputRange:[.9,1.18]})}]};
  const copyStyle={opacity:copy,transform:[{translateY:copy.interpolate({inputRange:[0,1],outputRange:[8,0]})}]};
  const frontRotate=rotation.interpolate({inputRange:[-3600,3600],outputRange:['-3600deg','3600deg']});
  const backRotate=Animated.add(rotation,180).interpolate({inputRange:[-3600,3600],outputRange:['-3600deg','3600deg']});

  return <View style={revealStyles.root}>
    <Animated.View style={[StyleSheet.absoluteFill,{opacity:backdrop}]}><BlurView blurMethod="dimezisBlurViewSdk31Plus" blurTarget={blurTarget} intensity={28} style={StyleSheet.absoluteFill} tint="dark"/><View style={revealStyles.backdropTint}/></Animated.View>
    <Pressable accessibilityLabel={badgeCopy.releaseHint} accessibilityRole="button" onPress={close} style={StyleSheet.absoluteFill}/>
    <Animated.View pointerEvents="box-none" style={[revealStyles.layer,layerStyle]}>
      <View pointerEvents="box-none" style={[revealStyles.topBar,{paddingTop:Math.max(insets.top,12)+10}]}>
        <Pressable accessibilityRole="button" hitSlop={12} onPress={close} style={({pressed})=>[revealStyles.closeButton,pressed&&styles.pressed]}><Ionicons color="#36564B" name="close" size={22}/></Pressable>
      </View>
      <View pointerEvents="box-none" style={revealStyles.content}>
        <View {...rotateResponder.panHandlers} accessibilityHint={badgeCopy.rotateHint} accessibilityLabel={`${badgeCopy.items[achievement.code]}. ${side==='front'?badgeCopy.frontSide:badgeCopy.backSide}`} accessibilityRole="adjustable" style={revealStyles.medalStage}>
        <Animated.View style={[revealStyles.halo,haloStyle]}/>
        <Animated.View style={[revealStyles.medalEntrance,medalStyle]}>
          <Animated.View style={[revealStyles.medalFace,{transform:[{perspective:1200},{rotateY:frontRotate}]}]}><Medal code={achievement.code} earned={achievement.status==='unlocked'} size={236}/></Animated.View>
          <Animated.View style={[revealStyles.medalFace,revealStyles.medalBackFace,{transform:[{perspective:1200},{rotateY:backRotate}]}]}>
            <View style={revealStyles.medalBackOuter}><View style={revealStyles.medalBackInner}><Ionicons color="#537A68" name="leaf-outline" size={38}/><Text style={revealStyles.medalBackBrand}>KITCHMEMO</Text><Text style={revealStyles.medalBackMark}>ECO MILESTONE</Text></View></View>
          </Animated.View>
        </Animated.View>
        </View>
        <Animated.View style={[revealStyles.sidePill,copyStyle]}><Ionicons color="#AFC1B9" name="swap-horizontal" size={15}/><Text style={revealStyles.sideText}>{badgeCopy.rotateHint}</Text></Animated.View>
        <Animated.View style={[revealStyles.copy,copyStyle]}>
          <Text style={revealStyles.detailTitle}>{badgeCopy.items[achievement.code]}</Text>
          <Text style={revealStyles.detailBody}>{badgeCopy.descriptions[achievement.code]}</Text>
          <Text style={revealStyles.detailReward}>{badgeCopy.reward(achievement.xpReward)}</Text>
        </Animated.View>
      </View>
    </Animated.View>
  </View>;
}

const revealStyles=StyleSheet.create({
  root:{position:'absolute',top:0,right:0,bottom:0,left:0,zIndex:40},
  backdropTint:{position:'absolute',top:0,right:0,bottom:0,left:0,backgroundColor:'rgba(8,27,21,.48)'},
  layer:{flex:1},
  topBar:{position:'absolute',top:0,right:0,left:0,zIndex:2,alignItems:'flex-end',paddingHorizontal:20,paddingBottom:8},
  closeButton:{width:46,height:46,alignItems:'center',justifyContent:'center',borderRadius:23,backgroundColor:'rgba(248,251,249,.9)',shadowColor:'#10271F',shadowOffset:{width:0,height:6},shadowOpacity:.2,shadowRadius:12,elevation:7},
  content:{flex:1,alignItems:'center',justifyContent:'center',paddingHorizontal:28,paddingTop:76,paddingBottom:30},
  medalStage:{width:276,height:276,alignItems:'center',justifyContent:'center'},
  medalEntrance:{width:236,height:236},
  medalFace:{position:'absolute',top:0,right:0,bottom:0,left:0,alignItems:'center',justifyContent:'center',backfaceVisibility:'hidden'},
  medalBackFace:{transform:[{rotateY:'180deg'}]},
  medalBackOuter:{width:196,height:196,alignItems:'center',justifyContent:'center',borderRadius:98,borderWidth:3,borderColor:'#C8B48A',backgroundColor:'#EEEBDD',shadowColor:'#000000',shadowOffset:{width:0,height:16},shadowOpacity:.36,shadowRadius:24,elevation:12},
  medalBackInner:{width:164,height:164,alignItems:'center',justifyContent:'center',borderRadius:82,borderWidth:1,borderColor:'#A9B8A7',backgroundColor:'#DDE6D8'},
  medalBackBrand:{marginTop:9,color:'#315F4F',fontSize:13,fontWeight:'900',letterSpacing:1.7},
  medalBackMark:{marginTop:5,color:'#73887D',fontSize:8,fontWeight:'800',letterSpacing:1.2},
  halo:{position:'absolute',width:238,height:238,borderRadius:119,backgroundColor:'rgba(241,230,201,.2)',borderWidth:1,borderColor:'rgba(236,211,164,.34)',shadowColor:'#EBD6A8',shadowOffset:{width:0,height:12},shadowOpacity:.26,shadowRadius:28,elevation:8},
  sidePill:{minHeight:34,flexDirection:'row',alignItems:'center',gap:7,marginTop:8,paddingHorizontal:13,borderRadius:17,backgroundColor:'rgba(255,255,255,.08)'},
  sideText:{color:'#AFC1B9',fontSize:10.5,fontWeight:'800'},
  copy:{maxWidth:430,alignItems:'center',marginTop:24},
  detailTitle:{color:'#F4F7F5',fontSize:27,fontWeight:'900',textAlign:'center'},
  detailBody:{marginTop:11,color:'#AFC1B9',fontSize:14,lineHeight:21,textAlign:'center'},
  detailReward:{marginTop:15,color:'#D7B06D',fontSize:14,fontWeight:'900'},
});

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

const styles=StyleSheet.create({root:{flex:1,backgroundColor:'#F5F8F6'},blurTarget:{flex:1},nav:{height:58,paddingHorizontal:12,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#DCE6E1'},navButton:{width:44,height:44,alignItems:'center',justifyContent:'center'},navTitle:{color:'#173D31',fontSize:17,fontWeight:'900'},tabs:{margin:14,padding:4,flexDirection:'row',backgroundColor:'#E8EFEB',borderRadius:14},tab:{flex:1,minHeight:38,alignItems:'center',justifyContent:'center',borderRadius:11},tabActive:{backgroundColor:'#FFFFFF'},tabText:{color:'#71847C',fontSize:13,fontWeight:'800'},tabTextActive:{color:'#244C3E'},journey:{padding:18,paddingBottom:80},summary:{padding:22,borderRadius:24,backgroundColor:'#E4EFE9'},summaryLabel:{color:'#6F817A',fontSize:10,fontWeight:'900',letterSpacing:1},summaryValue:{marginTop:6,color:'#214D3E',fontSize:38,fontWeight:'900'},summaryUnit:{fontSize:15},summaryCaption:{marginTop:8,color:'#60776E',fontSize:13,lineHeight:19,fontWeight:'600'},pathLine:{position:'absolute',top:180,bottom:60,left:'50%',width:2,backgroundColor:'#D8E4DE'},stop:{minHeight:150,width:'87%',flexDirection:'row',alignItems:'center',gap:13,zIndex:1},stopLeft:{alignSelf:'flex-start'},stopRight:{alignSelf:'flex-end',flexDirection:'row-reverse'},node:{width:48,height:48,borderRadius:24,alignItems:'center',justifyContent:'center',backgroundColor:'#EDF1EF',borderWidth:2,borderColor:'#D3DDD8'},nodeReached:{backgroundColor:'#DDEBE3',borderColor:'#7DA28D'},nodeCurrent:{width:58,height:58,borderRadius:29,backgroundColor:'#3C8064',borderColor:'#B9D6C6',borderWidth:5},nodeNumber:{color:'#9BA8A3',fontSize:14,fontWeight:'900'},nodeNumberCurrent:{color:'#FFFFFF'},levelCard:{flex:1,padding:15,borderRadius:18,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#E1EAE6'},levelCardCurrent:{borderColor:'#94BCA8',backgroundColor:'#FBFDFC'},levelNo:{color:'#7B8D85',fontSize:9,fontWeight:'900',letterSpacing:.8},levelName:{marginTop:5,color:'#264B40',fontSize:16,fontWeight:'900'},levelDescription:{marginTop:5,color:'#71847C',fontSize:10.5,fontWeight:'600',lineHeight:15},levelXp:{marginTop:5,color:'#8A6A42',fontSize:11,fontWeight:'800'},medalPage:{padding:18,paddingBottom:70},filters:{flexDirection:'row',gap:8,marginBottom:20},filter:{paddingHorizontal:16,minHeight:36,alignItems:'center',justifyContent:'center',borderRadius:18,backgroundColor:'#E8EFEB'},filterActive:{backgroundColor:'#315F4F'},filterText:{color:'#657970',fontSize:12,fontWeight:'800'},filterTextActive:{color:'#FFFFFF'},medalGrid:{flexDirection:'row',flexWrap:'wrap',gap:12},medalCell:{width:'47%',flexGrow:1,alignItems:'center',paddingVertical:18,paddingHorizontal:8,borderRadius:20,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#E3EAE7'},pressed:{opacity:.75,transform:[{scale:.98}]},medalArtwork:{alignItems:'center',justifyContent:'center'},medalImageLocked:{opacity:.38},medalLockVeil:{position:'absolute',top:0,right:0,bottom:0,left:0,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(245,248,246,.2)',borderRadius:999},medalLock:{width:30,height:30,borderRadius:15,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(250,252,251,.92)',borderWidth:1,borderColor:'rgba(83,102,94,.18)'},medalLockLarge:{width:42,height:42,borderRadius:21},medalName:{marginTop:8,color:'#244C3E',fontSize:13,fontWeight:'900',textAlign:'center'},muted:{color:'#7E8D87'},medalState:{marginTop:5,color:'#8A9A93',fontSize:10,fontWeight:'700'},detailScrim:{position:'absolute',top:0,right:0,bottom:0,left:0,backgroundColor:'rgba(18,39,32,.42)',justifyContent:'flex-end'},detail:{alignItems:'center',padding:28,paddingBottom:34,borderTopLeftRadius:28,borderTopRightRadius:28,backgroundColor:'#FAFCFB'},detailTitle:{marginTop:12,color:'#173D31',fontSize:24,fontWeight:'900'},detailBody:{marginTop:10,color:'#60756D',fontSize:14,lineHeight:21,textAlign:'center'},detailReward:{marginTop:14,color:'#A1683A',fontSize:13,fontWeight:'900'},done:{marginTop:22,minHeight:48,alignSelf:'stretch',alignItems:'center',justifyContent:'center',borderRadius:15,backgroundColor:'#315F4F'},doneText:{color:'#FFFFFF',fontSize:14,fontWeight:'900'}});
