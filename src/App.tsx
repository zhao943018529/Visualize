import React from "react";
import { Switch, Route, BrowserRouter as Router } from "react-router-dom";
import Home from "./pages/Home";
import BabylonPage from "./pages/Babylon";
import WebGL from "./pages/WebGL";
import Triangle from "./pages/Triangle";
import Triangle2 from "./pages/Triangle2";
import Triangle3 from "./pages/Triangle3";
import Circle from "./pages/Circle";
import Rectangle from "./pages/Rectangle";
import Texture from "./pages/Texture";
import Cube from "./pages/Cube";
import Cube2 from "./pages/Cube2";
import Cube3 from "./pages/Cube3";
import Sphere from "./pages/Sphere";
import Ambient from "./pages/Ambient";
import Euler from "./pages/Euler";
import Texture2 from "./pages/Texture2";
import Alpha from "./pages/Alpha";
import Normals from "./pages/Normals";
import SpotLight from "./pages/SpotLight";
import Robot from "./pages/Robot";
import Ferrari from "./pages/Ferrari";
import Twgl from "./pages/Twgl";
import Plane from "./pages/Plane";
import Frame from "./pages/Frame";
import Shadows from "./pages/Shadows";
import LightShadows from "./pages/LightShadows";
import LightShadow from "./pages/LightShadow";
import ReflectCube from "./pages/Reflect";
import Skinning from "./pages/Skinning";
import Skinning2 from "./pages/Skinning2";
import Fog from "./pages/Fog";
import Shadow1 from "./pages/Shadows1";
import DepthFrame from "./pages/DepthFrame";
import Picking from "./pages/Picking";
import HtmlText from "./pages/HtmlText";
import Skybox from "./pages/Skybox";
import CanvasText from "./pages/CanvasText";
import WebglText from "./pages/WebglText";
import GPGPU from "./pages/GPGPU";
import GPGPU2 from "./pages/GPGPU2";
import MultiView from "./pages/MultiView";
import VisualizingCamera from "./pages/VisualizingCamera";
import Billboard from "./pages/Billboard";
import DynamicReflect from "./pages/DynamicReflect";
import Scatter from "./pages/Scatter";
import Mirror from "./pages/Mirror";
import StencilBuffer from "./pages/StencilBuffer";
import Particles from "./pages/Particles";
import MRT from "./pages/MRT";
import MRTEdge from "./pages/EdgeLine";
import PixelsRead from "./pages/PixelsRead";
import BumpMap from "./pages/BumpMap";
import Skeleton from "./pages/Skeleton";
import TextureSkeleton from "./pages/TextureSkeleton";
import MySkin from "./pages/Skin";
import InstancedArray from "./pages/InstancedArray";
import ThreeLight from "./pages/Three/Light";
import ThreeCamera from "./pages/Three/Camera";
import ThreeShadow from "./pages/Three/Shadow";

function App() {
  return (
    <div>
      <Router>
        <Switch>
          <Route exact path="/">
            <Home />
          </Route>
          <Route path="/babylon">
            <BabylonPage />
          </Route>
          <Route path="/webgl">
            <WebGL />
          </Route>
          <Route path="/triangle">
            <Triangle />
          </Route>
          <Route path="/triangle2">
            <Triangle2 />
          </Route>
          <Route path="/triangle3">
            <Triangle3 />
          </Route>
          <Route path="/circle">
            <Circle />
          </Route>
          <Route path="/rectangle">
            <Rectangle />
          </Route>
          <Route path="/texture">
            <Texture />
          </Route>
          <Route path="/cube">
            <Cube />
          </Route>
          <Route path="/cube2">
            <Cube2 />
          </Route>
          <Route path="/cube3">
            <Cube3 />
          </Route>
          <Route path="/sphere">
            <Sphere />
          </Route>
          <Route path="/ambient">
            <Ambient />
          </Route>
          <Route path="/euler">
            <Euler />
          </Route>
          <Route path="/texture2">
            <Texture2 />
          </Route>
          <Route path="/alpha">
            <Alpha />
          </Route>
          <Route path="/normals">
            <Normals />
          </Route>
          <Route path="/spotlight">
            <SpotLight />
          </Route>
          <Route path="/robot">
            <Robot />
          </Route>
          <Route path="/ferrari">
            <Ferrari />
          </Route>
          <Route path="/twgl">
            <Twgl />
          </Route>
          <Route path="/plane">
            <Plane />
          </Route>
          <Route path="/frame">
            <Frame />
          </Route>
          <Route path="/shadows">
            <Shadows />
          </Route>
          <Route path="/light-shadows">
            <LightShadows />
          </Route>
          <Route path="/skinning">
            <Skinning />
          </Route>
          <Route path="/skinning2">
            <Skinning2 />
          </Route>
          <Route path="/fog">
            <Fog />
          </Route>
          <Route path="/shadow1">
            <Shadow1 />
          </Route>
          <Route path="/depth-frame">
            <DepthFrame />
          </Route>
          <Route path="/picking">
            <Picking />
          </Route>
          <Route path="/htmlText">
            <HtmlText />
          </Route>
          <Route path="/reflect">
            <ReflectCube />
          </Route>
          <Route path="/skybox">
            <Skybox />
          </Route>
          <Route path="/canvasText">
            <CanvasText />
          </Route>
          <Route path="/webglText">
            <WebglText />
          </Route>
          <Route path="/gpgpu">
            <GPGPU />
          </Route>
          <Route path="/gpgpu2">
            <GPGPU2 />
          </Route>
          <Route path="/multi-view">
            <MultiView />
          </Route>
          <Route path="/visualizing-camera">
            <VisualizingCamera />
          </Route>
          <Route path="/billboard">
            <Billboard />
          </Route>
          <Route path="/dynamic-reflect">
            <DynamicReflect />
          </Route>
          <Route path="/light-shadow">
            <LightShadow />
          </Route>
          <Route path="/scatter">
            <Scatter />
          </Route>
          <Route path="/mirror">
            <Mirror />
          </Route>
          <Route path="/stencil">
            <StencilBuffer />
          </Route>
          <Route path="/particles">
            <Particles />
          </Route>
          <Route path="/mrt">
            <MRT />
          </Route>
          <Route path="/mrt-edge">
            <MRTEdge />
          </Route>
          <Route path="/pixel-read">
            <PixelsRead />
          </Route>
          <Route path="/bump-map">
            <BumpMap />
          </Route>
          <Route path="/skeleton">
            <Skeleton />
          </Route>
          <Route path="/texture-skeleton">
            <TextureSkeleton />
          </Route>
          <Route path="/myskin">
            <MySkin />
          </Route>
          <Route path="/instance-array">
            <InstancedArray />
          </Route>
          <Route path="/three/light">
            <ThreeLight />
          </Route>
          <Route path="/three/camera">
            <ThreeCamera />
          </Route>
          <Route path="/three/shadow">
            <ThreeShadow />
          </Route>
        </Switch>
      </Router>
    </div>
  );
}

export default App;
