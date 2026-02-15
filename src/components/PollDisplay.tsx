import type { Poll, PollDisplayType } from '../types';

interface PollDisplayProps {
  poll: Poll;
  disableBackground?: boolean; // When true, don't apply background styles (used in preview popup)
}

export default function PollDisplay({ poll, disableBackground = false }: PollDisplayProps) {
  // Always use bars - only display type supported
  const primaryColor = poll.primaryColor || '#3B82F6';
  const secondaryColor = poll.secondaryColor || '#60A5FA';
  const emptyBarColor = poll.emptyBarColor || 'rgba(255, 255, 255, 0.7)';
  const showTitle = poll.showTitle !== false; // Default true
  const showVoteCount = poll.showVoteCount !== false; // Default true
  const layoutStyle = poll.layoutStyle || 1;
  const fullScreenStyle = poll.fullScreenStyle || 'horizontal';
  // Get barEdgeStyle for the bars themselves
  const barEdgeStyle = poll.barEdgeStyle || 'rounded';
  
  // Get borderRadius for the container/border (separate from bar edges)
  const borderRadius = poll.borderRadius ?? 0;
  const titleSize = poll.titleSize || 'large';
  const pipPosition = poll.pipPosition || 'right';
  const titleSettings = poll.titleSettings || {};
  const backgroundSettings = poll.backgroundSettings || {};
  const borderSettings = poll.borderSettings || {};
  
  const totalVotes = poll.options.reduce((sum, opt) => sum + (opt.votes || 0), 0);
  
  // Get border style for current layout
  const getBorderStyle = () => {
    let borderSetting;
    if (layoutStyle === 1) {
      borderSetting = borderSettings.fullScreen;
    } else if (layoutStyle === 2) {
      borderSetting = borderSettings.lowerThird;
    } else {
      borderSetting = borderSettings.pip;
    }
    
    // For all layouts (full screen, lower third, and PIP), borders are handled by the output page, not here
    if (layoutStyle === 1 || layoutStyle === 2 || layoutStyle === 3) {
      return {};
    }
    
    // For other layouts, check if border setting exists
    if (!borderSetting || !borderSetting.thickness || borderSetting.thickness === 0) {
      return {};
    }
    
    const thickness = borderSetting.thickness;
    const position = borderSetting.position || 'outer';
    const borderColor = primaryColor;
    
    if (position === 'inner') {
      // Inner border using box-shadow inset
      return {
        boxShadow: `inset 0 0 0 ${thickness}px ${borderColor}`,
      };
    } else {
      // Outer border using box-shadow
      return {
        boxShadow: `0 0 0 ${thickness}px ${borderColor}`,
      };
    }
  };
  
  // Get background style for current layout
  const getBackgroundStyle = () => {
    let bgSetting;
    if (layoutStyle === 1) {
      bgSetting = backgroundSettings.fullScreen;
    } else if (layoutStyle === 2) {
      bgSetting = backgroundSettings.lowerThird;
    } else {
      bgSetting = backgroundSettings.pip;
    }
    
    if (!bgSetting || !bgSetting.type || bgSetting.type === 'transparent') {
      return { background: 'transparent' };
    } else if (bgSetting.type === 'color') {
      return { background: bgSetting.color || 'transparent' };
    } else if (bgSetting.type === 'image' && bgSetting.imageUrl) {
      return {
        backgroundImage: `url(${bgSetting.imageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      };
    }
    return { background: 'transparent' };
  };

  // Get border radius value in pixels for the bars (based on barEdgeStyle)
  const getBarRadius = () => {
    switch (barEdgeStyle) {
      case 'square':
        return '0px';
      case 'beveled':
        return '4px'; // Slight rounded edge (subtle bevel)
      case 'rounded':
      default:
        return '9999px'; // Fully rounded (pill shape)
    }
  };
  
  // Get border radius for the container (based on borderRadius setting)
  const getContainerBorderRadius = () => {
    return `${borderRadius}px`;
  };


  // Auto-scale text based on content length (for option text, not title)
  const getAutoScaleClass = (text: string, baseSize: string, maxSize: string, minSize: string) => {
    const length = text.length;
    if (length <= 20) return maxSize;
    if (length <= 40) return baseSize;
    if (length <= 60) return minSize;
    // For very long text, use even smaller
    return `text-xs`;
  };

  const renderBars = () => {
    if (layoutStyle === 1) {
      // Full Screen - Broadcast-style horizontal bars with images
      // Adjust spacing and sizes based on number of options and title presence
      const hasTitle = showTitle;
      const optionCount = poll.options.length;
      const isCompact = optionCount >= 6 || (hasTitle && optionCount >= 4);
      
      const spacing = isCompact ? 'space-y-2' : 'space-y-4';
      const barHeight = isCompact ? 'h-6' : 'h-8';
      const imageSize = isCompact ? 'w-12 h-12' : 'w-16 h-16';
      const textSizeBase = isCompact ? 'text-xl md:text-2xl' : 'text-2xl md:text-3xl';
      const textSizeMax = isCompact ? 'text-2xl md:text-3xl' : 'text-3xl md:text-4xl';
      const textSizeMin = isCompact ? 'text-lg md:text-xl' : 'text-xl md:text-2xl';
      const voteSizeBase = isCompact ? 'text-lg md:text-xl' : 'text-xl md:text-2xl';
      const voteSizeMax = isCompact ? 'text-xl md:text-2xl' : 'text-2xl md:text-3xl';
      const voteSizeMin = isCompact ? 'text-base md:text-lg' : 'text-lg md:text-xl';
      const percentSize = isCompact ? 'text-sm' : 'text-base';
      
      if (fullScreenStyle === 'vertical') {
        // Vertical Bar style - bars arranged vertically side by side
        const gridCols = poll.options.length <= 3 ? `grid-cols-${poll.options.length}` : 'grid-cols-3';
        const maxCols = poll.options.length <= 3 ? poll.options.length : 3;
        const rows = Math.ceil(poll.options.length / maxCols);
        
        return (
          <div className={`w-full grid ${gridCols} gap-4 md:gap-6 px-6`} style={{ gridTemplateColumns: `repeat(${Math.min(poll.options.length, 6)}, 1fr)` }}>
            {poll.options.map((option, index) => {
              const votes = option.votes || 0;
              const percentage = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
              return (
                <div key={option.id} className="flex flex-col items-center">
                  {option.imageUrl && (
                    <img 
                      src={option.imageUrl} 
                      alt={option.text}
                      className={`${imageSize} object-contain mb-2`}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  )}
                  <span 
                    className={`font-bold text-white drop-shadow-lg text-center mb-2 ${getAutoScaleClass(option.text, textSizeBase, textSizeMax, textSizeMin)}`}
                    style={{ wordBreak: 'break-word' }}
                  >
                    {option.text}
                  </span>
                  {showVoteCount && (
                    <span className={`font-bold mb-2 ${getAutoScaleClass(votes.toString(), voteSizeBase, voteSizeMax, voteSizeMin)}`} style={{ color: primaryColor }}>{votes}</span>
                  )}
                  {/* Vertical bar - starts from bottom, goes up */}
                  <div className="w-full overflow-hidden shadow-inner relative" style={{ height: isCompact ? '120px' : '160px', background: emptyBarColor, borderRadius: getBarRadius() }}>
                    <div
                      className="w-full transition-all duration-700 ease-out flex items-end justify-center pb-2 absolute bottom-0"
                      style={{
                        height: `${percentage}%`,
                        background: `linear-gradient(180deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
                        boxShadow: `0 0 20px ${primaryColor}60`,
                        minHeight: percentage > 0 ? '8px' : '0',
                        borderRadius: getBarRadius(),
                      }}
                    >
                      {showVoteCount && percentage > 10 && (
                        <span className={`text-white font-extrabold ${percentSize} drop-shadow-lg`}>{Math.round(percentage)}%</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      } else {
        // Horizontal style - original with more spacing
        return (
          <div className={`w-full ${spacing} px-8`}>
            {poll.options.map((option, index) => {
              const votes = option.votes || 0;
              const percentage = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
              return (
                <div key={option.id}>
                  <div className="flex items-center gap-4 mb-2">
                    {option.imageUrl && (
                      <img 
                        src={option.imageUrl} 
                        alt={option.text}
                        className={`${imageSize} object-contain flex-shrink-0`}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1 gap-4">
                        <span 
                          className={`font-bold text-white drop-shadow-lg ${getAutoScaleClass(option.text, textSizeBase, textSizeMax, textSizeMin)}`}
                          style={{ wordBreak: 'break-word' }}
                        >
                          {option.text}
                        </span>
                        {showVoteCount && (
                          <span className={`font-bold flex-shrink-0 ${getAutoScaleClass(votes.toString(), voteSizeBase, voteSizeMax, voteSizeMin)}`} style={{ color: primaryColor }}>{votes}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className={`w-full ${barHeight} overflow-hidden shadow-inner`} style={{ background: emptyBarColor, borderRadius: getBarRadius() }}>
                    <div
                      className={`${barHeight} transition-all duration-700 ease-out flex items-center justify-end pr-4 relative`}
                      style={{
                        width: `${percentage}%`,
                        background: `linear-gradient(90deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
                        boxShadow: `0 0 30px ${primaryColor}60`,
                        borderRadius: getBarRadius(),
                      }}
                    >
                      {showVoteCount && (
                        <span className={`text-white font-extrabold ${percentSize} drop-shadow-lg`}>{Math.round(percentage)}%</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      }
    } else if (layoutStyle === 2) {
      // Lower Third - Horizontal bars at bottom of screen
      // Adjust spacing based on number of options
      const spacing = poll.options.length >= 6 ? 'space-y-2' : 'space-y-4';
      return (
        <div className={`w-full ${spacing} px-6`}>
          {poll.options.map((option, index) => {
            const votes = option.votes || 0;
            const percentage = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
            return (
              <div key={option.id}>
                <div className="flex items-center gap-3 mb-2">
                  {option.imageUrl && (
                    <img 
                      src={option.imageUrl} 
                      alt={option.text}
                      className="w-12 h-12 object-contain flex-shrink-0"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <span 
                        className={`font-bold text-white ${getAutoScaleClass(option.text, 'text-lg', 'text-xl', 'text-base')}`}
                        style={{ wordBreak: 'break-word' }}
                      >
                        {option.text}
                      </span>
                      {showVoteCount && (
                        <span className={`font-extrabold flex-shrink-0 ${getAutoScaleClass(votes.toString(), 'text-xl', 'text-2xl', 'text-lg')}`} style={{ color: primaryColor }}>{votes}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="w-full h-6 overflow-hidden" style={{ background: emptyBarColor, borderRadius: getBarRadius() }}>
                  <div
                    className="h-6 transition-all duration-700 ease-out flex items-center justify-end pr-3"
                    style={{
                      width: `${percentage}%`,
                      background: `linear-gradient(90deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
                      boxShadow: `0 0 15px ${primaryColor}80`,
                      borderRadius: getBarRadius(),
                    }}
                  >
                    {showVoteCount && (
                      <span className="text-white font-bold text-sm drop-shadow-lg">{Math.round(percentage)}%</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      );
    } else {
      // PIP (Picture-in-Picture) - Side box with compact bars
      // Adjust spacing based on number of options
      const spacing = poll.options.length >= 6 ? 'space-y-2' : 'space-y-3';
      return (
        <div className={`w-full ${spacing} px-4`}>
          {poll.options.map((option, index) => {
            const votes = option.votes || 0;
            const percentage = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
            return (
              <div key={option.id}>
                <div className="flex items-center gap-2 mb-1">
                  {option.imageUrl && (
                    <img 
                      src={option.imageUrl} 
                      alt={option.text}
                      className="w-8 h-8 object-contain flex-shrink-0"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  )}
                  <span 
                    className={`font-semibold text-white flex-1 ${getAutoScaleClass(option.text, 'text-xs', 'text-sm', 'text-xs')}`}
                    style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}
                  >
                    {option.text}
                  </span>
                  {showVoteCount && (
                    <span className={`font-bold flex-shrink-0 ${getAutoScaleClass(votes.toString(), 'text-base', 'text-lg', 'text-sm')}`} style={{ color: primaryColor }}>{votes}</span>
                  )}
                </div>
                <div className="w-full h-4 overflow-hidden" style={{ background: emptyBarColor, borderRadius: getBarRadius() }}>
                  <div
                    className="h-4 transition-all duration-500 flex items-center justify-end pr-2"
                    style={{ 
                      width: `${percentage}%`,
                      background: `linear-gradient(90deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
                      borderRadius: getBarRadius(),
                    }}
                  >
                    {showVoteCount && percentage > 20 && (
                      <span className="text-white font-bold text-xs">{Math.round(percentage)}%</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      );
    }
  };

  // Always render bars - only display type supported
  const renderDisplay = () => renderBars();

  // Get title settings for current layout
  const getTitleSettings = () => {
    if (layoutStyle === 1) {
      return titleSettings.fullScreen || { fontSize: 80, yPosition: 0, justification: 'center' };
    } else if (layoutStyle === 2) {
      return titleSettings.lowerThird || { fontSize: 50, yPosition: 0, justification: 'center' };
    } else {
      return titleSettings.pip || { fontSize: 40, yPosition: 0, justification: 'center' };
    }
  };

  const currentTitleSettings = getTitleSettings();
  const titleFontSize = currentTitleSettings.fontSize || 80;
  const titleYPosition = currentTitleSettings.yPosition || 0;
  const titleJustification = currentTitleSettings.justification || 'center';
  // Full screen only: Y position for where the content (title + bars) starts (positive = down)
  const fullScreenContentY = (layoutStyle === 1 && titleSettings.fullScreen?.contentYPosition != null) ? titleSettings.fullScreen.contentYPosition : 0;

  // Get text alignment style value based on justification
  const getJustificationStyle = () => {
    switch (titleJustification) {
      case 'left':
        return 'left';
      case 'right':
        return 'right';
      case 'center':
      default:
        return 'center';
    }
  };

  const backgroundStyle = disableBackground ? {} : getBackgroundStyle();
  const borderStyle = disableBackground ? {} : getBorderStyle();
  
  return (
    <div
      className="px-8 max-w-6xl w-full flex flex-col"
      style={{
        minHeight: '0',
        paddingTop: '0',
        ...backgroundStyle,
        ...borderStyle,
      }}
    >
      {showTitle && (
        <div
          className="flex-shrink-0 w-full"
          style={{
            marginTop: '0',
            paddingTop: '0.5rem',
            transform: `translateY(${titleYPosition}px)`, // Y position adjustment (title only)
            display: 'flex',
            justifyContent: titleJustification === 'left' ? 'flex-start' : titleJustification === 'right' ? 'flex-end' : 'center',
          }}
        >
          <div
            style={{
              maxWidth: '100%',
              width: titleJustification === 'center' ? '100%' : 'auto',
              minWidth: 0,
            }}
          >
            <h1
              className="font-bold mb-2 md:mb-4"
              style={{ 
                color: primaryColor,
                fontSize: `${titleFontSize}px`,
                lineHeight: '1.2',
                maxWidth: '100%',
                width: '100%',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
                textAlign: titleJustification === 'left' ? 'left' : titleJustification === 'right' ? 'right' : 'center',
              }}
            >
              {poll.title}
            </h1>
          </div>
        </div>
      )}
      <div
        className="flex-1 min-h-0 overflow-hidden hide-scrollbar"
        style={{
          overflowY: 'hidden',
          overflowX: 'hidden',
          ...(layoutStyle === 1 && fullScreenContentY !== 0 ? { marginTop: `${fullScreenContentY}px` } : {}),
        }}
      >
        {renderDisplay()}
      </div>
    </div>
  );
}

