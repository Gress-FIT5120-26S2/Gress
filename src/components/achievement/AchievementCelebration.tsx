import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

// Arthur: NarIyirm
// 中文：完成反馈只使用勾选、柔光与少量圆点，短暂停留后自动退场，避免纸屑动画打断主任务。
// EN: Completion feedback uses only a check, soft glow, and a few dots, then exits quickly without disruptive confetti.
export function AchievementCelebration({ xp, onDone }: { xp: number; onDone: () => void }) {
  const scale = useRef(new Animated.Value(.75)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.parallel([Animated.spring(scale,{toValue:1,useNativeDriver:true,damping:11,stiffness:150}),Animated.timing(opacity,{toValue:1,duration:180,useNativeDriver:true})]),
      Animated.delay(900), Animated.timing(opacity,{toValue:0,duration:260,useNativeDriver:true}),
    ]).start(({finished})=>{if(finished)onDone();});
  },[onDone,opacity,scale]);
  return <View pointerEvents="none" style={styles.root}><Animated.View style={[styles.glow,{opacity,transform:[{scale}]}]}><View style={styles.ring}><Ionicons color="#FFFFFF" name="checkmark" size={34}/></View><Text style={styles.xp}>+{xp} XP</Text>{[0,1,2,3,4].map((dot)=><View key={dot} style={[styles.dot,{transform:[{rotate:`${dot*72}deg`},{translateY:-62}]}]}/>)}</Animated.View></View>;
}
const styles=StyleSheet.create({root:{position:'absolute',top:0,right:0,bottom:0,left:0,zIndex:20,alignItems:'center',justifyContent:'center'},glow:{width:180,height:180,alignItems:'center',justifyContent:'center',borderRadius:90,backgroundColor:'rgba(229,244,235,.94)'},ring:{width:72,height:72,borderRadius:36,alignItems:'center',justifyContent:'center',backgroundColor:'#3A8667',borderWidth:6,borderColor:'#C9E3D5'},xp:{marginTop:12,color:'#A6622F',fontSize:18,fontWeight:'900'},dot:{position:'absolute',top:84,width:7,height:7,borderRadius:4,backgroundColor:'#C59055'}});
