import { useTheme } from '../context/useTheme';
import './css/AnimatedBackground.css';

const NebulaBackground = () => (
  <div className="bg-layer bg-nebula">
    <div className="stars" />
    <div className="stars-b" />
    <div className="shooting-star" />
    <div className="shooting-star" />
    <div className="shooting-star" />
    <div className="shooting-star" />
    <div className="shooting-star" />
  </div>
);

const AuroraBackground = () => (
  <div className="bg-layer bg-aurora">
    <div className="aurora-stars" />
    <div className="aurora-curtain c1" />
    <div className="aurora-curtain c2" />
    <div className="aurora-curtain c3" />
    <div className="aurora-ribbon r1" />
    <div className="aurora-ribbon r2" />
    <div className="aurora-horizon" />
  </div>
);

const SUNSET_EMBERS = [
  { x: '8%', s: '3px', t: '16s', d: '-2s', w: '24px' },
  { x: '19%', s: '2px', t: '21s', d: '-11s', w: '-30px' },
  { x: '31%', s: '4px', t: '18s', d: '-6s', w: '36px' },
  { x: '44%', s: '2px', t: '24s', d: '-15s', w: '-22px' },
  { x: '57%', s: '3px', t: '19s', d: '-9s', w: '28px' },
  { x: '68%', s: '2px', t: '23s', d: '-4s', w: '-34px' },
  { x: '79%', s: '4px', t: '17s', d: '-13s', w: '26px' },
  { x: '91%', s: '3px', t: '20s', d: '-7s', w: '-24px' },
];

const SunsetBackground = () => (
  <div className="bg-layer bg-sunset">
    <div className="sunset-glow" />
    <div className="sunset-sun" />
    <div className="sunset-cloud k1" />
    <div className="sunset-cloud k2" />
    <div className="sunset-cloud k3" />
    <div className="sunset-haze" />
    {SUNSET_EMBERS.map((e, i) => (
      <div
        key={i}
        className="sunset-ember"
        style={{ '--x': e.x, '--s': e.s, '--t': e.t, '--d': e.d, '--w': e.w }}
      />
    ))}
    <div className="sunset-horizon" />
  </div>
);

const OCEAN_BUBBLES = [
  { x: '6%', s: '10px', t: '19s', d: '-3s', w: '16px' },
  { x: '17%', s: '6px', t: '24s', d: '-14s', w: '-12px' },
  { x: '29%', s: '14px', t: '21s', d: '-8s', w: '20px' },
  { x: '42%', s: '8px', t: '26s', d: '-19s', w: '-16px' },
  { x: '55%', s: '12px', t: '22s', d: '-5s', w: '18px' },
  { x: '68%', s: '6px', t: '25s', d: '-12s', w: '-14px' },
  { x: '80%', s: '10px', t: '20s', d: '-17s', w: '16px' },
  { x: '92%', s: '8px', t: '23s', d: '-9s', w: '-18px' },
];

const OceanBackground = () => (
  <div className="bg-layer bg-ocean">
    <div className="ocean-sun" />
    <div className="ocean-rays r1" />
    <div className="ocean-rays r2" />
    {OCEAN_BUBBLES.map((b, i) => (
      <div
        key={i}
        className="ocean-bubble"
        style={{ '--x': b.x, '--s': b.s, '--t': b.t, '--d': b.d, '--w': b.w }}
      />
    ))}
    <div className="ocean-swell s1">
      <div className="ocean-wave w1" />
    </div>
    <div className="ocean-swell s2">
      <div className="ocean-wave w2" />
    </div>
    <div className="ocean-swell s3">
      <div className="ocean-wave w3" />
    </div>
  </div>
);

const PAPER_MOTES = [
  { x: '7%', y: '78%', s: '3px', t: '38s', d: '-6s', w: '30px' },
  { x: '15%', y: '40%', s: '2px', t: '46s', d: '-22s', w: '-26px' },
  { x: '26%', y: '88%', s: '4px', t: '42s', d: '-14s', w: '34px' },
  { x: '38%', y: '58%', s: '2px', t: '50s', d: '-30s', w: '-22px' },
  { x: '49%', y: '82%', s: '3px', t: '40s', d: '-9s', w: '28px' },
  { x: '61%', y: '34%', s: '2px', t: '48s', d: '-26s', w: '-32px' },
  { x: '72%', y: '70%', s: '4px', t: '44s', d: '-18s', w: '24px' },
  { x: '83%', y: '92%', s: '3px', t: '39s', d: '-3s', w: '-28px' },
  { x: '91%', y: '52%', s: '2px', t: '52s', d: '-34s', w: '26px' },
  { x: '54%', y: '20%', s: '3px', t: '45s', d: '-12s', w: '-24px' },
];

const PaperBackground = () => (
  <div className="bg-layer bg-paper">
    <div className="paper-drift" />
    <div className="paper-light l1" />
    <div className="paper-light l2" />
    <div className="paper-grain" />
    {PAPER_MOTES.map((m, i) => (
      <div
        key={i}
        className="paper-mote"
        style={{ '--x': m.x, '--y': m.y, '--s': m.s, '--t': m.t, '--d': m.d, '--w': m.w }}
      />
    ))}
  </div>
);

const CyberBackground = () => (
  <div className="bg-layer bg-cyber">
    <div className="cyber-stars" />
    <div className="cyber-sun" />
    <div className="cyber-mountains" />
    <div className="cyber-floor">
      <div className="cyber-plane">
        <div className="cyber-grid" />
      </div>
    </div>
    <div className="cyber-horizon" />
    <div className="cyber-beam" />
  </div>
);

const FOREST_FIREFLIES = [
  { x: '9%', y: '72%', t: '17s', b: '4.2s', d: '-3s', dx: '70px', dy: '-90px' },
  { x: '18%', y: '55%', t: '21s', b: '5.1s', d: '-11s', dx: '-60px', dy: '-70px' },
  { x: '27%', y: '82%', t: '19s', b: '3.8s', d: '-7s', dx: '80px', dy: '-110px' },
  { x: '36%', y: '46%', t: '23s', b: '4.6s', d: '-15s', dx: '-90px', dy: '60px' },
  { x: '45%', y: '68%', t: '18s', b: '5.4s', d: '-5s', dx: '60px', dy: '-80px' },
  { x: '54%', y: '88%', t: '22s', b: '3.6s', d: '-13s', dx: '-70px', dy: '-100px' },
  { x: '63%', y: '52%', t: '20s', b: '4.9s', d: '-9s', dx: '90px', dy: '70px' },
  { x: '72%', y: '76%', t: '24s', b: '4.0s', d: '-17s', dx: '-80px', dy: '-90px' },
  { x: '81%', y: '60%', t: '16s', b: '5.2s', d: '-1s', dx: '70px', dy: '-60px' },
  { x: '90%', y: '84%', t: '21s', b: '3.9s', d: '-10s', dx: '-60px', dy: '-110px' },
  { x: '13%', y: '38%', t: '25s', b: '4.4s', d: '-19s', dx: '60px', dy: '80px' },
  { x: '77%', y: '36%', t: '22s', b: '5.0s', d: '-6s', dx: '-70px', dy: '70px' },
];

const ForestBackground = () => (
  <div className="bg-layer bg-forest">
    <div className="forest-rays" />
    <div className="forest-fog a" />
    <div className="forest-fog b" />
    <div className="forest-trees far" />
    <div className="forest-trees near" />
    {FOREST_FIREFLIES.map((f, i) => (
      <div
        key={i}
        className="firefly"
        style={{
          '--x': f.x,
          '--y': f.y,
          '--t': f.t,
          '--b': f.b,
          '--d': f.d,
          '--dx': f.dx,
          '--dy': f.dy,
        }}
      />
    ))}
  </div>
);

const MonochromeBackground = () => (
  <div className="bg-layer bg-monochrome">
    <div className="mono-bokeh o1" />
    <div className="mono-bokeh o2" />
    <div className="mono-bokeh o3" />
    <div className="mono-beam left" />
    <div className="mono-beam right" />
    <div className="mono-spotlight" />
    <div className="mono-grain" />
    <div className="mono-flicker" />
    <div className="mono-vignette" />
  </div>
);

const BLOSSOM_PETALS = [
  { x: '4%', s: '14px', t: '15s', d: '-2s', w: '60px', r: '5s', o: '0.85', f: '0px' },
  { x: '10%', s: '9px', t: '21s', d: '-12s', w: '-50px', r: '6s', o: '0.6', f: '1px' },
  { x: '17%', s: '18px', t: '13s', d: '-7s', w: '70px', r: '4.5s', o: '0.9', f: '0px' },
  { x: '25%', s: '11px', t: '19s', d: '-15s', w: '-60px', r: '5.5s', o: '0.7', f: '0.5px' },
  { x: '32%', s: '16px', t: '16s', d: '-4s', w: '55px', r: '4.8s', o: '0.85', f: '0px' },
  { x: '39%', s: '8px', t: '24s', d: '-19s', w: '-45px', r: '6.5s', o: '0.55', f: '1.5px' },
  { x: '46%', s: '13px', t: '17s', d: '-9s', w: '65px', r: '5.2s', o: '0.8', f: '0px' },
  { x: '53%', s: '19px', t: '14s', d: '-1s', w: '-70px', r: '4.4s', o: '0.9', f: '0px' },
  { x: '60%', s: '10px', t: '22s', d: '-16s', w: '50px', r: '6s', o: '0.6', f: '1px' },
  { x: '67%', s: '15px', t: '18s', d: '-6s', w: '-60px', r: '5s', o: '0.85', f: '0px' },
  { x: '74%', s: '9px', t: '25s', d: '-21s', w: '55px', r: '6.8s', o: '0.5', f: '1.5px' },
  { x: '81%', s: '17px', t: '15s', d: '-10s', w: '-65px', r: '4.6s', o: '0.9', f: '0px' },
  { x: '88%', s: '12px', t: '20s', d: '-3s', w: '60px', r: '5.4s', o: '0.75', f: '0.5px' },
  { x: '94%', s: '8px', t: '23s', d: '-13s', w: '-40px', r: '6.2s', o: '0.55', f: '1.5px' },
  { x: '22%', s: '12px', t: '26s', d: '-23s', w: '50px', r: '5.8s', o: '0.65', f: '1px' },
  { x: '78%', s: '14px', t: '27s', d: '-18s', w: '-55px', r: '5.6s', o: '0.7', f: '0.5px' },
];

const BlossomBackground = () => (
  <div className="bg-layer bg-blossom">
    <div className="blossom-glow" />
    <div className="blossom-bokeh b1" />
    <div className="blossom-bokeh b2" />
    <div className="blossom-bokeh b3" />
    <div className="blossom-gust" />
    {BLOSSOM_PETALS.map((p, i) => (
      <div
        key={i}
        className="petal"
        style={{
          '--x': p.x,
          '--s': p.s,
          '--t': p.t,
          '--d': p.d,
          '--w': p.w,
          '--r': p.r,
          '--o': p.o,
          '--f': p.f,
        }}
      />
    ))}
  </div>
);

const EclipseBackground = () => (
  <div className="bg-layer bg-eclipse">
    <div className="eclipse-stars" />
    <div className="eclipse-orb o1" />
    <div className="eclipse-orb o2" />
    <div className="eclipse-orb o3" />
    <div className="eclipse-rays" />
    <div className="eclipse-corona" />
    <div className="eclipse-moon" />
    <div className="eclipse-ring" />
    <div className="eclipse-ring r2" />
  </div>
);

const GalaxyBackground = () => (
  <div className="bg-layer bg-galaxy">
    <div className="galaxy-spiral" />
    <div className="galaxy-spiral s2" />
    <div className="galaxy-core" />
    <div className="galaxy-stars a" />
    <div className="galaxy-stars b" />
    <div className="galaxy-stars c" />
    <div className="galaxy-comet c1" />
    <div className="galaxy-comet c2" />
  </div>
);

const StormBackground = () => (
  <div className="bg-layer bg-storm">
    <div className="storm-cloud k1" />
    <div className="storm-cloud k2" />
    <div className="storm-rain far" />
    <div className="storm-rain mid" />
    <div className="storm-rain near" />
    <div className="storm-mist" />
    <div className="storm-flash" />
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
  galaxy: GalaxyBackground,
  storm: StormBackground,
};

export default function AnimatedBackground() {
  const { theme, performanceMode } = useTheme();
  if (performanceMode) return <div className={`bg-layer bg-${BACKGROUNDS[theme] ? theme : 'nebula'}`} />;
  const Background = BACKGROUNDS[theme] || NebulaBackground;
  return <Background />;
}
