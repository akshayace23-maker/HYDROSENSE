// Animated three.js water scene for the landing page
window.HS_hero=function(canvas){
  if(!window.THREE||!canvas) return function(){};
  var T=THREE,reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  var renderer;try{renderer=new T.WebGLRenderer({canvas:canvas,alpha:true,antialias:true});}catch(e){return function(){};}
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
  var scene=new T.Scene(),cam=new T.PerspectiveCamera(55,1,0.1,200);cam.position.set(0,7,16);cam.lookAt(0,0,0);
  // wave plane
  var geo=new T.PlaneGeometry(60,40,70,46);geo.rotateX(-Math.PI/2);
  var base=geo.attributes.position.array.slice();
  var plane=new T.Mesh(geo,new T.MeshBasicMaterial({color:0x14b8a6,wireframe:true,transparent:true,opacity:.42}));plane.position.y=-3;scene.add(plane);
  // droplet (glowing wireframe icosahedron stretched into a drop)
  var drop=new T.Group();
  var d1=new T.Mesh(new T.IcosahedronGeometry(2.2,2),new T.MeshBasicMaterial({color:0x5eead4,wireframe:true,transparent:true,opacity:.9}));
  var d2=new T.Mesh(new T.IcosahedronGeometry(1.5,1),new T.MeshBasicMaterial({color:0x38bdf8,transparent:true,opacity:.28}));
  drop.add(d1,d2);drop.position.set(5.2,2.2,0);scene.add(drop);
  // rings
  var rings=[];for(var i=0;i<3;i++){var r=new T.Mesh(new T.RingGeometry(1,1.04,64),new T.MeshBasicMaterial({color:0x7dd3fc,transparent:true,opacity:.5,side:T.DoubleSide}));r.rotation.x=-Math.PI/2;r.position.set(5.2,-2.9,0);scene.add(r);rings.push(r);}
  // floating particles
  var N=260,pg=new T.BufferGeometry(),pp=new Float32Array(N*3);
  for(var j=0;j<N;j++){pp[j*3]=(Math.random()-.5)*50;pp[j*3+1]=Math.random()*16-3;pp[j*3+2]=(Math.random()-.5)*30;}
  pg.setAttribute('position',new T.BufferAttribute(pp,3));
  var pts=new T.Points(pg,new T.PointsMaterial({color:0xa5f3fc,size:.12,transparent:true,opacity:.8}));scene.add(pts);
  var mx=0,my=0;
  function mm(e){mx=(e.clientX/innerWidth-.5);my=(e.clientY/innerHeight-.5);}
  addEventListener('mousemove',mm);
  function size(){var w=canvas.clientWidth||innerWidth,h=canvas.clientHeight||500;renderer.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix();drop.position.x=w<700?0:5.2;drop.position.y=w<700?4.5:2.2;}
  size();addEventListener('resize',size);
  var raf,t0=performance.now(),alive=true;
  function frame(now){
    if(!alive) return;
    if(!document.body.contains(canvas)){stop();return;}
    var t=(now-t0)/1000,p=geo.attributes.position.array;
    for(var k=0;k<p.length;k+=3){var x=base[k],z=base[k+2];p[k+1]=Math.sin(x*.4+t*1.1)*.7+Math.cos(z*.5+t*.8)*.6+Math.sin((x+z)*.25+t*.5)*.4;}
    geo.attributes.position.needsUpdate=true;
    drop.rotation.y=t*.5;drop.rotation.z=Math.sin(t*.6)*.15;drop.position.y=(drop.position.y>3.5?4.5:2.2)+Math.sin(t*1.2)*.5;
    rings.forEach(function(r,i){var s=((t*.5+i/3)%1);r.scale.setScalar(1+s*7);r.material.opacity=.55*(1-s);r.position.x=drop.position.x;});
    pts.rotation.y=t*.02;
    cam.position.x+=((mx*5)-cam.position.x)*.04;cam.position.y+=((7-my*3)-cam.position.y)*.04;cam.lookAt(0,0,0);
    renderer.render(scene,cam);
    if(!reduce) raf=requestAnimationFrame(frame);
  }
  raf=requestAnimationFrame(frame);
  function stop(){alive=false;cancelAnimationFrame(raf);removeEventListener('mousemove',mm);removeEventListener('resize',size);try{renderer.dispose();geo.dispose();}catch(e){}}
  return stop;
};
