import type { QandA } from '../types';

interface QADisplayProps {
  qa: QandA;
  disableBackground?: boolean; // Prevent QADisplay from rendering its own background when used in preview/output
}

export default function QADisplay({ qa, disableBackground = false }: QADisplayProps) {
  const layoutStyle = qa.layoutStyle || 1;
  const primaryColor = qa.primaryColor || '#3B82F6';
  const secondaryColor = qa.secondaryColor || '#60A5FA';
  const titleSize = qa.titleSize || 'large';
  const showTitle = qa.showTitle !== false; // Default true
  const showName = qa.showName !== false; // Default true
  const borderSettings = qa.borderSettings || {};
  const backgroundSettings = qa.backgroundSettings || {};
  
  // Get border style for current layout
  const getBorderStyle = () => {
    let borderSetting;
    if (layoutStyle === 1) {
      borderSetting = borderSettings.fullScreen;
    } else if (layoutStyle === 2) {
      borderSetting = borderSettings.lowerThird;
    } else if (layoutStyle === 3) {
      borderSetting = borderSettings.pip;
    } else {
      borderSetting = borderSettings.splitScreen;
    }
    
    // For lower third, borders are handled by the output page, not here
    if (layoutStyle === 2) {
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
    } else if (layoutStyle === 3) {
      bgSetting = backgroundSettings.pip;
    } else {
      bgSetting = backgroundSettings.splitScreen;
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
  
  // Get title settings for current layout
  const getTitleSettings = () => {
    if (!qa.titleSettings) return {};
    if (layoutStyle === 1) return qa.titleSettings.fullScreen || {};
    if (layoutStyle === 2) return qa.titleSettings.lowerThird || {};
    if (layoutStyle === 3) return qa.titleSettings.pip || {};
    if (layoutStyle === 4) return qa.titleSettings.splitScreen || {};
    return {};
  };
  
  // Get answer settings for current layout
  const getAnswerSettings = () => {
    if (!qa.answerSettings) return {};
    if (layoutStyle === 1) return qa.answerSettings.fullScreen || {};
    if (layoutStyle === 2) return qa.answerSettings.lowerThird || {};
    if (layoutStyle === 3) return qa.answerSettings.pip || {};
    if (layoutStyle === 4) return qa.answerSettings.splitScreen || {};
    return {};
  };
  
  // Get name settings for current layout
  const getNameSettings = () => {
    if (!qa.nameSettings) return {};
    if (layoutStyle === 1) return qa.nameSettings.fullScreen || {};
    if (layoutStyle === 2) return qa.nameSettings.lowerThird || {};
    if (layoutStyle === 3) return qa.nameSettings.pip || {};
    if (layoutStyle === 4) return qa.nameSettings.splitScreen || {};
    return {};
  };

  const titleSettings = getTitleSettings();
  const answerSettings = getAnswerSettings();
  const nameSettings = getNameSettings();
  
  const titleFontSize = titleSettings.fontSize || (titleSize === 'large' ? 48 : titleSize === 'medium' ? 36 : 24);
  const titleYPosition = titleSettings.yPosition || 0;
  const titleJustification = titleSettings.justification || 'center';
  
  const answerFontSize = answerSettings.fontSize || (titleFontSize * 0.8);
  const answerYPosition = answerSettings.yPosition || 0;
  const answerJustification = answerSettings.justification || 'center';
  
  const nameFontSize = nameSettings.fontSize || (titleFontSize * 0.6);
  const nameYPosition = nameSettings.yPosition || 0;
  const nameJustification = nameSettings.justification || 'center';

  const titleStyle: React.CSSProperties = {
    fontSize: `${titleFontSize}px`,
    transform: titleYPosition !== 0 ? `translateY(${titleYPosition}px)` : undefined,
    textAlign: titleJustification as 'left' | 'center' | 'right',
    color: primaryColor,
    fontWeight: 'bold',
    lineHeight: '1.2',
    padding: '20px',
    wordWrap: 'break-word',
  };

  const answerStyle: React.CSSProperties = {
    color: '#ffffff',
    fontSize: `${answerFontSize}px`,
    textAlign: answerJustification as 'left' | 'center' | 'right',
    lineHeight: '1.5',
    padding: '20px',
    wordWrap: 'break-word',
  };
  
  const nameStyle: React.CSSProperties = {
    color: '#ffffff',
    fontSize: `${nameFontSize}px`,
    textAlign: nameJustification as 'left' | 'center' | 'right',
    fontStyle: 'italic',
    wordWrap: 'break-word',
  };

  const displayQuestion = qa.question || qa.name || 'Question';

  const renderContent = () => {
    if (layoutStyle === 1) {
      // Full Screen Layout
      return (
        <div className="w-full h-full flex flex-col items-center justify-center" style={{ padding: '40px', height: '100%' }}>
          {showTitle && (
            <div style={titleStyle} className="mb-8">
              {displayQuestion}
            </div>
          )}
          {qa.answer && (
            <div style={answerStyle} className="max-w-4xl">
              {qa.answer}
            </div>
          )}
          {showName && qa.submitterName && (
            <div style={{ ...nameStyle, marginTop: '16px' }}>
              — {qa.submitterName}
            </div>
          )}
        </div>
      );
    } else if (layoutStyle === 2) {
      // Lower Third Layout - positioned at bottom like polls
      // Equal spacing from border line to title, and from name to bottom
      const titleFontSizeValue = titleSettings.fontSize || Math.max(titleFontSize * 0.6, 28);
      const answerFontSizeValue = answerSettings.fontSize || Math.max(answerFontSize * 0.7, 20);
      const nameFontSizeValue = nameSettings.fontSize || Math.max(nameFontSize * 0.7, 16);
      
      // Get border thickness to adjust spacing when Box Edge is selected
      const lowerThirdBorder = borderSettings.lowerThird;
      const borderType = (lowerThirdBorder as any)?.type || lowerThirdBorder?.position || 'line';
      const hasBoxEdge = borderType === 'boxEdge' || borderType === 'boxInner' || borderType === 'inner';
      const borderThickness = (hasBoxEdge && lowerThirdBorder?.thickness) ? lowerThirdBorder.thickness : 0;
      
      // Calculate spacing between elements proportionally
      const titleHeight = titleFontSizeValue * 1.2;
      const answerHeight = answerFontSizeValue * 1.5;
      const nameHeight = nameFontSizeValue * 1.2;
      const containerHeight = 180; // Lower third height
      
      // Border takes up space, so reduce available height
      // For Box Edge, border is inside the container, so it reduces available space
      const availableHeight = containerHeight - (borderThickness * 2);
      
      const totalContentHeight = (showTitle ? titleHeight : 0) + (qa.answer ? answerHeight : 0) + ((showName && qa.submitterName) ? nameHeight : 0);
      const elementCount = (showTitle ? 1 : 0) + (qa.answer ? 1 : 0) + ((showName && qa.submitterName) ? 1 : 0);
      
      // Calculate spacing between elements
      const remainingSpace = availableHeight - totalContentHeight;
      const spacingBetween = elementCount > 1 ? remainingSpace / (elementCount + 1) : 0;
      
      // Calculate top padding to center content vertically
      // Equal spacing above first element and below last element
      const topPadding = spacingBetween;
      const bottomPadding = spacingBetween;
      
      return (
        <div className="w-full h-full flex flex-col justify-center" style={{ 
          paddingLeft: '24px', 
          paddingRight: '24px',
          paddingTop: `${topPadding}px`,
          paddingBottom: `${bottomPadding}px`,
        }}>
          {showTitle && (
            <div style={{ 
              ...titleStyle, 
              fontSize: `${titleFontSizeValue}px`, 
              marginBottom: qa.answer ? `${spacingBetween}px` : '0',
              padding: 0,
              textAlign: titleJustification as 'left' | 'center' | 'right',
              transform: titleYPosition !== 0 ? `translateY(${titleYPosition}px)` : undefined,
            }}>
              {displayQuestion}
            </div>
          )}
          {qa.answer && (
            <div style={{ 
              ...answerStyle, 
              fontSize: `${answerFontSizeValue}px`,
              padding: 0,
              marginBottom: (showName && qa.submitterName) ? `${spacingBetween}px` : '0',
              textAlign: answerJustification as 'left' | 'center' | 'right',
              transform: answerYPosition !== 0 ? `translateY(${answerYPosition}px)` : undefined,
            }}>
              {qa.answer}
            </div>
          )}
          {showName && qa.submitterName && (
            <div style={{ 
              ...nameStyle, 
              fontSize: `${nameFontSizeValue}px`,
              padding: 0,
              textAlign: nameJustification as 'left' | 'center' | 'right',
              transform: nameYPosition !== 0 ? `translateY(${nameYPosition}px)` : undefined,
            }}>
              — {qa.submitterName}
            </div>
          )}
        </div>
      );
    } else if (layoutStyle === 3) {
      // PIP Layout (side box, similar to current split screen)
      const position = qa.splitScreenPosition || 'left';
      return (
        <div
          className="w-full h-full flex flex-col"
          style={{ padding: '16px', justifyContent: 'center' }}
        >
          {showTitle && (
            <div style={{ 
              ...titleStyle, 
              fontSize: titleSettings.fontSize || Math.max(titleFontSize * 0.5, 24), 
              marginBottom: '12px', 
              width: '100%',
              padding: 0,
              textAlign: titleJustification as 'left' | 'center' | 'right',
            }}>
              {displayQuestion}
            </div>
          )}
          {qa.answer && (
            <div style={{ 
              ...answerStyle, 
              fontSize: answerSettings.fontSize || Math.max(answerFontSize * 0.6, 18), 
              width: '100%',
              padding: 0,
              textAlign: answerJustification as 'left' | 'center' | 'right',
            }}>
              {qa.answer}
            </div>
          )}
          {showName && qa.submitterName && (
            <div style={{ 
              ...nameStyle, 
              fontSize: nameSettings.fontSize || Math.max(nameFontSize * 0.5, 14), 
              marginTop: '10px', 
              width: '100%',
              padding: 0,
              textAlign: nameJustification as 'left' | 'center' | 'right',
            }}>
              — {qa.submitterName}
            </div>
          )}
        </div>
      );
    } else {
      // Layout 4: Split Screen (left/right split)
      const side = qa.splitScreenSide || 'left';
      return (
        <div
          className="w-full h-full flex flex-col"
          style={{ padding: '16px', justifyContent: 'center' }}
        >
          {showTitle && (
            <div style={{ 
              ...titleStyle, 
              fontSize: titleSettings.fontSize || Math.max(titleFontSize * 0.5, 24), 
              marginBottom: '12px', 
              width: '100%',
              padding: 0,
              textAlign: titleJustification as 'left' | 'center' | 'right',
              transform: titleYPosition !== 0 ? `translateY(${titleYPosition}px)` : undefined,
            }}>
              {displayQuestion}
            </div>
          )}
          {qa.answer && (
            <div style={{ 
              ...answerStyle, 
              fontSize: answerSettings.fontSize || Math.max(answerFontSize * 0.6, 18), 
              width: '100%',
              padding: 0,
              textAlign: answerJustification as 'left' | 'center' | 'right',
              transform: answerYPosition !== 0 ? `translateY(${answerYPosition}px)` : undefined,
            }}>
              {qa.answer}
            </div>
          )}
          {showName && qa.submitterName && (
            <div style={{ 
              ...nameStyle, 
              fontSize: nameSettings.fontSize || Math.max(nameFontSize * 0.5, 14), 
              marginTop: '10px', 
              width: '100%',
              padding: 0,
              textAlign: nameJustification as 'left' | 'center' | 'right',
              transform: nameYPosition !== 0 ? `translateY(${nameYPosition}px)` : undefined,
            }}>
              — {qa.submitterName}
            </div>
          )}
        </div>
      );
    }
  };

  const borderStyle = disableBackground ? {} : getBorderStyle();
  const backgroundStyle = disableBackground ? {} : getBackgroundStyle();

  if (disableBackground) {
    // Just render content, background and border are handled by parent (for preview/output)
    return <>{renderContent()}</>;
  }

  // Render with background and border (for standalone display/preview)
  // Apply both to the same container that wraps the content
  return (
    <div className="w-full h-full" style={{ ...backgroundStyle, ...borderStyle }}>
      {renderContent()}
    </div>
  );
}

