import { useTheme } from '../context/useTheme';
import './css/AnimatedBackground.css';

const NebulaBackground = () => (
  <div className="bg-layer bg-nebula">
    <div className="stars" />
    <div className="shooting-star" />
    <div className="shooting-star" />
    <div className="shooting-star" />
    <div className="shooting-star" />
    <div className="shooting-star" />
  </div>
);

const AuroraBackground = () => (
  <div className="bg-layer bg-aurora">
    <div className="aurora-ribbon r1" />
    <div className="aurora-ribbon r2" />
    <div className="aurora-ribbon r3" />
  </div>
);

const SunsetBackground = () => (
  <div className="bg-layer bg-sunset">
    <div className="sunset-glow" />
    <div className="sunset-blob b1" />
    <div className="sunset-blob b2" />
    <div className="sunset-blob b3" />
  </div>
);

const OceanBackground = () => (
  <div className="bg-layer bg-ocean">
    <div className="wave-band w1" />
    <div className="wave-band w2" />
    <div className="wave-band w3" />
  </div>
);

const PaperBackground = () => (
  <div className="bg-layer bg-paper">
    <div className="paper-grain" />
    <div className="paper-drift" />
  </div>
);

const CyberBackground = () => (
  <div className="bg-layer bg-cyber">
    <div className="cyber-grid" />
    <div className="cyber-sun" />
    <div className="cyber-beam" />
  </div>
);

const ForestBackground = () => (
  <div className="bg-layer bg-forest">
    <div className="firefly f1" />
    <div className="firefly f2" />
    <div className="firefly f3" />
    <div className="firefly f4" />
    <div className="firefly f5" />
    <div className="firefly f6" />
    <div className="firefly f7" />
    <div className="firefly f8" />
  </div>
);

const MonochromeBackground = () => (
  <div className="bg-layer bg-monochrome">
    <div className="mono-grain" />
    <div className="mono-spotlight" />
  </div>
);

const BlossomBackground = () => (
  <div className="bg-layer bg-blossom">
    <div className="petal p1" />
    <div className="petal p2" />
    <div className="petal p3" />
    <div className="petal p4" />
    <div className="petal p5" />
    <div className="petal p6" />
    <div className="petal p7" />
  </div>
);

const EclipseBackground = () => (
  <div className="bg-layer bg-eclipse">
    <div className="eclipse-orb o1" />
    <div className="eclipse-orb o2" />
    <div className="eclipse-orb o3" />
    <div className="eclipse-ring" />
  </div>
);

const BACKGROUNDS = {
  nebula: NebulaBackground,
  aurora: AuroraBackground,
  sunset: SunsetBackground,
  ocean: OceanBackground,
  paper: PaperBackground,
  cyber: CyberBackground,
  forest: ForestBackground,
  monochrome: MonochromeBackground,
  blossom: BlossomBackground,
  eclipse: EclipseBackground,
};

export default function AnimatedBackground() {
  const { theme } = useTheme();
  const Background = BACKGROUNDS[theme] || NebulaBackground;
  return <Background />;
}
