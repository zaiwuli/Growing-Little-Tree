export const scenes = [
  { id:'camp', name:'萌芽营地', threshold:0, badge:'出发的小树苗', description:'收拾好行囊，从一颗小小的种子出发。' },
  { id:'forest', name:'森林秘境', threshold:100, badge:'森林探索者', description:'沿着溪流，寻找藏在树叶间的秘密。' },
  { id:'ocean', name:'蔚蓝海洋', threshold:300, badge:'海洋发现家', description:'扬起风帆，和鱼群一起寻找珊瑚岛。' },
  { id:'desert', name:'金沙绿洲', threshold:600, badge:'沙漠旅行家', description:'穿过金色沙丘，发现属于你的绿洲。' },
  { id:'snow', name:'雪山之巅', threshold:1000, badge:'勇敢登山者', description:'一步一个脚印，向阳光下的山顶前进。' },
  { id:'sky', name:'云端星岛', threshold:1500, badge:'星岛领航员', description:'让每一份坚持，点亮云端的一颗星。' }
];
export const discoveries = {
 camp:[['🔦','探路手电筒','走夜路要和大人同行，手电筒不要照向别人的眼睛。'],['⛺','第一顶帐篷','露营要选择允许的安全区域，离开时带走垃圾。'],['🐶','小狗伙伴','领养意味着责任：每天提供清水、食物和温柔的照顾。']],
 forest:[['🧭','森林指南针','指南针帮助辨别方向，户外仍要跟紧家长。'],['🔍','观察放大镜','观察昆虫时不伤害、不随意捕捉，给小生命留空间。'],['🦊','狐狸伙伴','野生狐狸属于森林，不喂食、不靠近；这里是虚拟伙伴。']],
 ocean:[['🦺','航海救生衣','靠近深水需要家长陪伴，下水前穿戴合适的救生装备。'],['🐚','海洋观察册','贝壳也可能是动物的家，观察后把它留在原地。'],['🐢','海龟伙伴','减少一次性塑料，避免垃圾进入海洋。']],
 desert:[['💧','补水水壶','户外活动及时喝水，不等口渴才补水。'],['👒','遮阳帽','强日照时做好防晒，选择合适的出行时间。'],['🐪','骆驼伙伴','骆驼驼峰主要储存脂肪，并不是装水的水箱。']],
 snow:[['🧣','保暖围巾','寒冷天气注意保暖，衣物潮湿时及时更换。'],['🔭','远望镜','望远镜不能直接看太阳，会伤害眼睛。'],['🐧','企鹅伙伴','企鹅主要生活在南半球，北极并没有野生企鹅。']],
 sky:[['🗺️','星空图册','辨认星座要结合季节和地点，和家人一起观察。'],['🚀','想象飞船','太空没有可直接呼吸的空气，宇航员需要生命保障系统。'],['🐱','星岛猫咪','虚拟宠物不需要反复喂养，不会因为你离线而生病。']]
};
export const defaultSegments = [500, 1000, 1500, 2000, 3000];
export function adventure(state, child) {
  const includeBonus = !!state.adventures?.[child]?.includeBonus;
  const points = Math.max(0, state.ledger.filter(l => l.child === child && (includeBonus ? ['task','reverse','bonus'] : ['task','reverse']).includes(l.kind)).reduce((n,l) => n+l.amount,0));
  state.adventures ||= {};
  const record = state.adventures[child] ||= { unlocked:{}, selected:'camp' };
  const segments = record.segments || defaultSegments;
  let total = 0;
  const configured = scenes.map((s,i) => ({ ...s, threshold: i === 0 ? 0 : (total += segments[i-1]) }));
  for(const scene of configured) if(points >= scene.threshold && !record.unlocked[scene.id]) record.unlocked[scene.id] = new Date().toISOString();
  record.discoveries ||= {};
  const routes = configured.map((scene,i)=>{
    const end = configured[i+1]?.threshold ?? scene.threshold + segments.at(-1);
    const progress = Math.max(0,Math.min(1,(points-scene.threshold)/(end-scene.threshold)));
    const nodes = discoveries[scene.id].map(([icon,name,lesson],j)=>{
      const key=scene.id+'-'+j, required=scene.threshold+Math.ceil((end-scene.threshold)*(j+1)/4);
      if(record.unlocked[scene.id] && points>=required && !record.discoveries[key]) record.discoveries[key]={at:new Date().toISOString()};
      return {key,icon,name,lesson,required,percent:(j+1)*25,earnedAt:record.discoveries[key]?.at || null};
    });
    return {scene:scene.id,start:scene.threshold,end,progress,nodes};
  });
  const reached = configured.filter(s => record.unlocked[s.id]).at(-1);
  if(!record.unlocked[record.selected]) record.selected = reached.id;
  return { routes, points, includeBonus, segments:[...segments], scenes:configured.map(s => ({...s,unlockedAt:record.unlocked[s.id] || null})), selected:record.selected, reached:reached.id, next:configured.find(s => !record.unlocked[s.id])?.id || null };
}
