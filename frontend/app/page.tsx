{/* ✅ Player hand - wooden rack design like photo 1 */}
<div className="relative z-10">
  {/* Rode lijn bovenaan zoals foto 1 */}
  <div className="h-1 bg-gradient-to-r from-red-600 via-red-500 to-red-600" />
  
  {/* Houten/stenen rack achtergrond */}
  <div className="relative overflow-hidden" style={{
    background: "linear-gradient(180deg, #5C4033 0%, #6B4C3B 15%, #7A5A48 30%, #8B6B56 50%, #7A5A48 70%, #6B4C3B 85%, #5C4033 100%)",
    boxShadow: "inset 0 2px 10px rgba(0,0,0,0.5), inset 0 -2px 10px rgba(0,0,0,0.3)",
  }}>
    {/* Hout textuur overlay */}
    <div className="absolute inset-0 opacity-20" style={{
      backgroundImage: `repeating-linear-gradient(
        0deg,
        transparent,
        transparent 8px,
        rgba(0,0,0,0.1) 8px,
        rgba(0,0,0,0.1) 9px
      ), repeating-linear-gradient(
        90deg,
        transparent,
        transparent 30px,
        rgba(0,0,0,0.05) 30px,
        rgba(0,0,0,0.05) 31px
      )`,
    }} />
    
    {/* Steen/baksteen patroon */}
    <div className="absolute inset-0 opacity-10" style={{
      backgroundImage: `repeating-linear-gradient(
        0deg,
        transparent,
        transparent 20px,
        rgba(255,255,255,0.1) 20px,
        rgba(255,255,255,0.1) 21px
      )`,
    }} />

    {/* Metalen rand links en rechts */}
    <div className="absolute left-0 top-0 bottom-0 w-2" style={{
      background: "linear-gradient(90deg, #3a3a4a, #5a5a6a, #3a3a4a)",
    }} />
    <div className="absolute right-0 top-0 bottom-0 w-2" style={{
      background: "linear-gradient(90deg, #3a3a4a, #5a5a6a, #3a3a4a)",
    }} />

    {/* Waarschuwing */}
    {!canAny() && myTurn && !gameOver && cPile > 0 && (
      <div className="text-center text-red-400/90 text-[10px] font-bold pt-2 animate-pulse drop-shadow-lg">⚠️ No matching tile - draw!</div>
    )}
    
    {/* Domino tegels */}
    <div className="flex justify-center gap-1.5 overflow-x-auto py-3 px-4" style={{ scrollbarWidth: "none" }}>
      {hand.map((t, i) => {
        const ends = getEnds(board);
        const ok = !board.length || canPlay(t, board, ends) !== null;
        return (
          <div 
            key={`${t[0]}-${t[1]}-${i}`} 
            onClick={() => play(t, i)}
            className={`flex-shrink-0 transition-all duration-200 ${
              !myTurn || gameOver 
                ? "opacity-15 pointer-events-none" 
                : ok 
                  ? "active:scale-90 sm:hover:-translate-y-3 sm:hover:shadow-xl cursor-pointer" 
                  : "opacity-20"
            }`}
          >
            <HandTile v={t} hl={ok && myTurn && !gameOver} sm={hand.length > 7} />
          </div>
        );
      })}
    </div>
  </div>

  {/* Groene rand onderaan */}
  <div className="h-1 bg-gradient-to-r from-[#21A038] via-[#2D8A3E] to-[#21A038]" />
</div>