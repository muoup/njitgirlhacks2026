/**
 * Shared low-poly shapes for the grove scene, referenced with <use href="#grove-…">.
 * Everything is drawn around its base at (0, 0) so it can be placed with a transform.
 * Trees and thickets take their three tones from the layer they are used in (see grove.css).
 */
export function GroveSymbols() {
  return (
    <svg aria-hidden="true" width="0" height="0" className="absolute">
      <defs>
        <g id="grove-tree-a">
          <polygon className="grove-t3" points="-7,0 7,0 10,-160 2,-160" />
          <polygon className="grove-t3" points="4,-110 40,-160 44,-154 8,-98" />
          <polygon className="grove-t3" points="-70,-150 -50,-200 -10,-214 24,-190 20,-150 -20,-128 -56,-132" />
          <polygon className="grove-t1" points="-30,-215 -6,-268 44,-286 88,-258 96,-208 62,-172 10,-170 -22,-186" />
          <polygon className="grove-t1" points="30,-176 70,-196 108,-176 112,-140 80,-120 44,-128" />
          <polygon className="grove-t2" points="-4,-262 30,-306 70,-300 92,-266 64,-236 22,-232" />
          <polygon className="grove-t2" points="-64,-176 -40,-204 -8,-196 -4,-166 -32,-150 -58,-156" />
        </g>
        <g id="grove-tree-b">
          <polygon className="grove-t3" points="-8,0 8,0 5,-90 -5,-90" />
          <polygon className="grove-t3" points="-4,-80 -44,-126 -38,-130 0,-92" />
          <polygon className="grove-t3" points="4,-80 40,-120 46,-116 6,-70" />
          <polygon className="grove-t3" points="-110,-110 -84,-152 -40,-160 -14,-130 -30,-98 -78,-90" />
          <polygon className="grove-t3" points="30,-120 60,-156 106,-150 124,-116 100,-90 52,-88" />
          <polygon className="grove-t1" points="-60,-150 -34,-200 20,-212 62,-186 66,-146 28,-118 -28,-120" />
          <polygon className="grove-t1" points="70,-150 96,-170 122,-150 116,-124 86,-118" />
          <polygon className="grove-t2" points="-28,-186 4,-226 46,-218 60,-186 30,-164 -8,-164" />
          <polygon className="grove-t2" points="-96,-128 -70,-148 -44,-136 -48,-110 -78,-104" />
        </g>
        <g id="grove-tree-c">
          <polygon className="grove-t3" points="-5,0 6,0 3,-120 -2,-120" />
          <polygon className="grove-t3" points="-56,-96 -30,-140 16,-150 54,-126 58,-92 20,-76 -30,-78" />
          <polygon className="grove-t1" points="-44,-150 -18,-200 26,-206 50,-170 34,-136 -14,-130" />
          <polygon className="grove-t2" points="-30,-204 -6,-256 26,-250 40,-212 18,-186 -16,-188" />
          <polygon className="grove-t1" points="-14,-252 6,-306 26,-268 20,-240 -4,-238" />
          <polygon className="grove-t2" points="-50,-118 -24,-136 -4,-120 -14,-98 -42,-96" />
        </g>
        <g id="grove-thicket">
          <polygon className="grove-t3" points="-100,8 -90,-40 -50,-60 -10,-44 0,8" />
          <polygon className="grove-t1" points="-30,8 -24,-50 20,-74 62,-54 70,8" />
          <polygon className="grove-t2" points="40,8 50,-36 84,-48 112,-24 110,8" />
          <polygon className="grove-t2" points="-66,8 -60,-28 -34,-38 -14,-20 -16,8" />
        </g>
        <g id="grove-ridge">
          <polygon className="grove-t3" points="0,40 10,-40 50,-66 96,-50 110,40" />
          <polygon className="grove-t1" points="70,40 84,-70 130,-104 178,-84 196,40" />
          <polygon className="grove-t3" points="210,40 226,-80 262,-120 304,-96 318,40" />
          <polygon className="grove-t2" points="150,40 164,-36 200,-58 238,-40 250,40" />
          <polygon className="grove-t1" points="280,40 296,-44 330,-60 362,-36 370,40" />
          <polygon className="grove-t2" points="100,40 112,-30 140,-44 166,-28 172,40" />
        </g>
        <g id="grove-shroom">
          <polygon points="-7,0 8,0 5,-36 -5,-36" fill="#e9dfc6" />
          <polygon points="0,0 8,0 5,-36 0,-36" fill="rgb(0 0 0 / 0.14)" />
          <polygon points="-30,-30 30,-30 20,-24 -20,-24" fill="#7a4a2c" />
          <polygon points="-36,-30 -28,-52 -10,-64 12,-64 29,-52 36,-30" className="fill-grove-ember" />
          <polygon points="-10,-64 12,-64 29,-52 0,-46" className="fill-grove-ember-hi" />
          <polygon points="-36,-30 -28,-52 0,-46 -8,-30" fill="rgb(0 0 0 / 0.12)" />
          <polygon points="-16,-50 -11,-54 -7,-49 -12,-45" fill="#fbf1dc" />
          <polygon points="10,-40 16,-43 19,-37 13,-34" fill="#fbf1dc" />
          <polygon points="-24,-38 -20,-41 -17,-36 -22,-34" fill="#fbf1dc" />
        </g>
        <g id="grove-shroom-wrinkled">
          <polygon points="-6,0 7,0 9,-18 4,-32 -5,-32 -3,-16" fill="#807f6a" />
          <polygon points="1,0 7,0 9,-18 4,-32 0,-32 2,-16" fill="rgb(0 0 0 / 0.18)" />
          <g fill="none" stroke="rgb(20 12 6 / 0.4)" strokeWidth="1.2">
            <polyline points="-4,-10 6,-12" />
            <polyline points="-3,-22 6,-24" />
          </g>
          <polygon
            points="-34,-22 -30,-40 -18,-52 -4,-50 8,-56 24,-48 33,-34 35,-20 22,-26 10,-22 -4,-27 -18,-22"
            fill="#6e5a46"
          />
          <polygon points="-4,-50 8,-56 24,-48 6,-42" fill="rgb(255 255 255 / 0.07)" />
          <polygon points="-34,-22 -30,-40 -10,-36 -18,-22" fill="rgb(0 0 0 / 0.16)" />
          <g fill="none" stroke="rgb(20 12 6 / 0.45)" strokeWidth="1.5" strokeLinejoin="round">
            <polyline points="-18,-50 -14,-38 -18,-25" />
            <polyline points="-3,-49 2,-38 -3,-28" />
            <polyline points="11,-54 13,-40 10,-24" />
            <polyline points="24,-46 21,-36 24,-27" />
          </g>
        </g>
        <g id="grove-fairy-wings">
          <polygon points="-1,-3 -15,-14 -11,0" fill="rgb(226 244 218 / 0.62)" />
          <polygon points="-1,-1 -10,8 -4,1" fill="rgb(200 232 196 / 0.45)" />
          <polygon points="1,-3 15,-14 11,0" fill="rgb(226 244 218 / 0.62)" />
          <polygon points="1,-1 10,8 4,1" fill="rgb(200 232 196 / 0.45)" />
        </g>
        <g id="grove-fairy-body">
          <circle r="8" fill="rgb(243 230 168 / 0.28)" />
          <polygon points="0,-9 2.4,-6.5 0,-4 -2.4,-6.5" fill="#fbf1dc" />
          <polygon points="0,-4 2.5,0 0,9 -2.5,0" fill="#fbf1dc" />
        </g>
        <g id="grove-tuft">
          <polygon points="0,0 -6,-34 4,-4" />
          <polygon points="-4,0 -26,-26 2,-6" />
          <polygon points="2,0 22,-30 8,-2" />
          <polygon points="4,0 10,-44 12,-2" />
        </g>
      </defs>
    </svg>
  );
}
