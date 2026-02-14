import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { getEvent, getPollsByEvent, getQAsByEvent, getQAsByStatus } from '../services/firestore';
import type { Event, Poll, QandA } from '../types';
import PollDisplay from '../components/PollDisplay';
import QADisplay from '../components/QADisplay';
import { getAnimationSettings, getAnimationClasses, getTransitionInClass, getAnimationOutStyle, afterDelayThenPaint } from '../utils/animations';
import { QAStatus } from '../types';

// Base dimensions for consistent scaling
const BASE_WIDTH = 960;
const BASE_HEIGHT = 540;

// Generic content item type
type ContentItem = Poll | QandA;
type ContentType = 'poll' | 'qa';

export default function FullscreenOutputPage() {
  const { eventId, layoutFilter } = useParams<{ eventId: string; layoutFilter?: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [qas, setQAs] = useState<QandA[]>([]);
  const [activeContent, setActiveContent] = useState<ContentItem | null>(null);
  const [contentType, setContentType] = useState<ContentType>('poll');
  const [isVisible, setIsVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const lastLoadedEventOutput = useRef<{ eventId: string; outputNum: number } | null>(null);

  // Animation settings from localStorage
  const [animationSettings, setAnimationSettings] = useState(getAnimationSettings());
  
  // Parse output number: layoutFilter is now the output number (1-4)
  const outputNum = layoutFilter ? parseInt(layoutFilter, 10) : 1;

  // Shared helper: find active content for this output (polls take priority over Q&As)
  const findActiveContentForOutput = (pollsData: Poll[], qasData: QandA[]) => {
    const activePoll = pollsData.find((p) => {
      if (!p.isActive) return false;
      const outputSettings = p.outputSettings || {};
      return (
        (outputSettings.fullScreen?.includes(outputNum)) ||
        (outputSettings.lowerThird?.includes(outputNum)) ||
        (outputSettings.pip?.includes(outputNum))
      );
    });
    if (activePoll) {
      const outputSettings = activePoll.outputSettings || {};
      let layoutToShow = activePoll.layoutStyle || 1;
      if (outputSettings.fullScreen?.includes(outputNum)) layoutToShow = 1;
      else if (outputSettings.lowerThird?.includes(outputNum)) layoutToShow = 2;
      else if (outputSettings.pip?.includes(outputNum)) layoutToShow = 3;
      return { content: { ...activePoll, layoutStyle: layoutToShow } as Poll, type: 'poll' as ContentType };
    }
    const qaQuestions = qasData.filter(qa => qa.question && !qa.name);
    const activeQA = qaQuestions.find((qa) => {
      if (!qa.isActive) return false;
      const outputSettings = qa.outputSettings || {};
      return (
        (outputSettings.fullScreen?.includes(outputNum)) ||
        (outputSettings.lowerThird?.includes(outputNum)) ||
        (outputSettings.splitScreen?.includes(outputNum)) ||
        (outputSettings.pip?.includes(outputNum))
      );
    });
    if (activeQA) {
      const outputSettings = activeQA.outputSettings || {};
      let layoutToShow = activeQA.layoutStyle || 1;
      if (outputSettings.fullScreen?.includes(outputNum)) layoutToShow = 1;
      else if (outputSettings.lowerThird?.includes(outputNum)) layoutToShow = 2;
      else if (outputSettings.pip?.includes(outputNum)) layoutToShow = 3;
      else if (outputSettings.splitScreen?.includes(outputNum)) layoutToShow = 4;
      return { content: { ...activeQA, layoutStyle: layoutToShow } as QandA, type: 'qa' as ContentType };
    }
    return null;
  };

  // Calculate scale factor based on viewport size
  const getScaleFactor = () => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Calculate scale to fit viewport while maintaining 16:9 aspect ratio
    const scaleX = viewportWidth / BASE_WIDTH;
    const scaleY = viewportHeight / BASE_HEIGHT;
    return Math.min(scaleX, scaleY);
  };

  const [scaleFactor, setScaleFactor] = useState(getScaleFactor());

  // Update scale on window resize
  useEffect(() => {
    const handleResize = () => {
      setScaleFactor(getScaleFactor());
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Listen for animation settings changes (from OperatorsPage)
  useEffect(() => {
    const handleStorageChange = () => {
      setAnimationSettings(getAnimationSettings());
    };
    window.addEventListener('storage', handleStorageChange);
    // Also check periodically in case localStorage is updated in same window
    const interval = setInterval(() => {
      const newSettings = getAnimationSettings();
      if (JSON.stringify(newSettings) !== JSON.stringify(animationSettings)) {
        setAnimationSettings(newSettings);
      }
    }, 500);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [animationSettings]);

  useEffect(() => {
    if (!eventId) return;

    // Helper function to find active content (polls take priority over Q&As) - moved outside for reuse
    const findActiveContent = (pollsData: Poll[], qasData: QandA[]) => {
      // First check polls
      const activePoll = pollsData.find((p) => {
        if (!p.isActive) return false;
        const outputSettings = p.outputSettings || {};
        return (
          (outputSettings.fullScreen?.includes(outputNum)) ||
          (outputSettings.lowerThird?.includes(outputNum)) ||
          (outputSettings.pip?.includes(outputNum))
        );
      });
      
      if (activePoll) {
        const outputSettings = activePoll.outputSettings || {};
        let layoutToShow = activePoll.layoutStyle || 1;
        if (outputSettings.fullScreen?.includes(outputNum)) {
          layoutToShow = 1;
        } else if (outputSettings.lowerThird?.includes(outputNum)) {
          layoutToShow = 2;
        } else if (outputSettings.pip?.includes(outputNum)) {
          layoutToShow = 3;
        }
        return { content: { ...activePoll, layoutStyle: layoutToShow } as Poll, type: 'poll' as ContentType };
      }
      
      // Then check Q&As
      // Filter to only check individual Q&A questions (submissions), not session containers
      const qaQuestions = qasData.filter(qa => qa.question && !qa.name);
      const activeQA = qaQuestions.find((qa) => {
        if (!qa.isActive) return false;
        const outputSettings = qa.outputSettings || {};
        return (
          (outputSettings.fullScreen?.includes(outputNum)) ||
          (outputSettings.lowerThird?.includes(outputNum)) ||
          (outputSettings.splitScreen?.includes(outputNum)) ||
          (outputSettings.pip?.includes(outputNum))
        );
      });
      
      if (activeQA) {
        const outputSettings = activeQA.outputSettings || {};
        let layoutToShow = activeQA.layoutStyle || 1;
        if (outputSettings.fullScreen?.includes(outputNum)) {
          layoutToShow = 1;
        } else if (outputSettings.lowerThird?.includes(outputNum)) {
          layoutToShow = 2;
        } else if (outputSettings.pip?.includes(outputNum)) {
          layoutToShow = 3;
        } else if (outputSettings.splitScreen?.includes(outputNum)) {
          layoutToShow = 4;
        }
        return { content: { ...activeQA, layoutStyle: layoutToShow } as QandA, type: 'qa' as ContentType };
      }
      
      return null;
    };

    const loadData = async () => {
      try {
        const [eventData, pollsData, qasData] = await Promise.all([
          getEvent(eventId),
          getPollsByEvent(eventId),
          getQAsByEvent(eventId),
        ]);

        setEvent(eventData);
        setPolls(pollsData);
        setQAs(qasData);
        
        // For Q&A questions without outputSettings, copy from parent session or use default so active Q&A is always findable
        const defaultOutputSettings = { fullScreen: [1], lowerThird: [1], pip: [1], splitScreen: [1] };
        const qaSessions = qasData.filter(qa => qa.name && !qa.question);
        const qaQuestions = qasData.filter(qa => qa.question && !qa.name);
        const qaQuestionsWithSettings = qaQuestions.map(qa => {
          const hasSettings = qa.outputSettings && Object.keys(qa.outputSettings).length > 0;
          if (hasSettings) return qa;
          const parentSession = qaSessions.find(session => session.eventId === qa.eventId);
          const fromParent = parentSession?.outputSettings && Object.keys(parentSession.outputSettings).length > 0
            ? parentSession.outputSettings
            : null;
          return { ...qa, outputSettings: fromParent || defaultOutputSettings };
        });
        const enrichedQasData = [...qaSessions, ...qaQuestionsWithSettings];
        
        const activeResult = findActiveContent(pollsData, enrichedQasData);
        
        if (activeResult) {
          setActiveContent(activeResult.content);
          setContentType(activeResult.type);
          setIsVisible(false);
          const delayMs = getAnimationSettings().qaAnimateInDelayMs ?? 100;
          afterDelayThenPaint(delayMs, () => setIsVisible(true));
        }
      } catch (err) {
        console.error('Failed to load event data:', err);
      } finally {
        setLoading(false);
      }
    };

    // Only run initial load when event or output number changed (prevents flicker when isVisible flips)
    const sameEventOutput = lastLoadedEventOutput.current?.eventId === eventId && lastLoadedEventOutput.current?.outputNum === outputNum;
    if (!sameEventOutput) {
      lastLoadedEventOutput.current = eventId && outputNum ? { eventId, outputNum } : null;
      loadData();
    }
    // Set up real-time listener for active content and updates
    const interval = setInterval(async () => {
      try {
        const [pollsData, qasData] = await Promise.all([
          getPollsByEvent(eventId),
          getQAsByEvent(eventId),
        ]);
        
        // For Q&A questions without outputSettings, copy from parent session or use default so active Q&A is always findable
        const defaultOutputSettings = { fullScreen: [1], lowerThird: [1], pip: [1], splitScreen: [1] };
        const qaSessions = qasData.filter(qa => qa.name && !qa.question);
        const qaQuestions = qasData.filter(qa => qa.question && !qa.name);
        const qaQuestionsWithSettings = qaQuestions.map(qa => {
          const hasSettings = qa.outputSettings && Object.keys(qa.outputSettings).length > 0;
          if (hasSettings) return qa;
          const parentSession = qaSessions.find(session => session.eventId === qa.eventId);
          const fromParent = parentSession?.outputSettings && Object.keys(parentSession.outputSettings).length > 0
            ? parentSession.outputSettings
            : null;
          return { ...qa, outputSettings: fromParent || defaultOutputSettings };
        });
        const enrichedQasData = [...qaSessions, ...qaQuestionsWithSettings];
        
        const activeResult = findActiveContent(pollsData, enrichedQasData);
        const currentActiveId = activeContent?.id;

        if (activeResult && activeResult.content.id !== currentActiveId) {
          // New active content - animate out current, then in new with transition-in delay
          setIsVisible(false);
          setTimeout(() => {
            setActiveContent(activeResult.content);
            setContentType(activeResult.type);
            setIsVisible(false);
            const delayMs = getAnimationSettings().qaAnimateInDelayMs ?? 100;
            afterDelayThenPaint(delayMs, () => setIsVisible(true));
          }, 500);
        } else if (!activeResult && activeContent) {
          // No active content - animate out
          if (isVisible) {
            setIsVisible(false);
            setTimeout(() => {
              setActiveContent(null);
            }, 500);
          } else {
            setActiveContent(null);
          }
        } else if (activeResult && activeResult.content.id === currentActiveId && activeContent) {
          // Same content but data may have updated - update without animation
          if (contentType === 'poll') {
            const currentVotes = (activeContent as Poll).options.map(o => o.votes || 0).join(',');
            const newVotes = (activeResult.content as Poll).options.map(o => o.votes || 0).join(',');
          if (currentVotes !== newVotes) {
              setActiveContent(activeResult.content);
            }
          } else if (contentType === 'qa') {
            // For Q&A, check if question or answer changed
            const currentQA = activeContent as QandA;
            const newQA = activeResult.content as QandA;
            if (currentQA.question !== newQA.question || currentQA.answer !== newQA.answer) {
              setActiveContent(activeResult.content);
            }
          }
        }
      } catch (err) {
        console.error('Error checking for active content:', err);
      }
    }, 1000); // Check every 1 second for real-time updates

    return () => clearInterval(interval);
  }, [eventId, outputNum, activeContent?.id, isVisible, contentType]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-white text-2xl">Loading...</div>
      </div>
    );
  }

  if (!activeContent) {
    // Show nothing when there's no active content - just black screen
    return <div className="fixed inset-0 bg-black" />;
  }

  const layoutStyle = contentType === 'poll' 
    ? (activeContent as Poll).layoutStyle || 1
    : (activeContent as QandA).layoutStyle || 1;
  
  // Get background style for layout container
  const getLayoutBackgroundStyle = () => {
    if (contentType === 'poll') {
      const poll = activeContent as Poll;
      if (!poll?.backgroundSettings) return {};
      let bgSetting;
      if (layoutStyle === 1) {
        bgSetting = poll.backgroundSettings.fullScreen;
      } else if (layoutStyle === 2) {
        bgSetting = poll.backgroundSettings.lowerThird;
      } else {
        bgSetting = poll.backgroundSettings.pip;
      }
      
      if (!bgSetting || !bgSetting.type || bgSetting.type === 'transparent') {
        return {};
      } else if (bgSetting.type === 'color') {
        return { background: bgSetting.color || 'rgba(0,0,0,0.95)' };
      } else if (bgSetting.type === 'image' && bgSetting.imageUrl) {
        return {
          backgroundImage: `url(${bgSetting.imageUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        };
      }
    } else if (contentType === 'qa') {
      const qa = activeContent as QandA;
      if (!qa?.backgroundSettings) return {};
    let bgSetting;
    if (layoutStyle === 1) {
        bgSetting = qa.backgroundSettings.fullScreen;
    } else if (layoutStyle === 2) {
        bgSetting = qa.backgroundSettings.lowerThird;
    } else if (layoutStyle === 3) {
        bgSetting = qa.backgroundSettings.pip;
    } else {
        bgSetting = qa.backgroundSettings.splitScreen;
    }
    
    if (!bgSetting || !bgSetting.type || bgSetting.type === 'transparent') {
      return {};
    } else if (bgSetting.type === 'color') {
      return { background: bgSetting.color || 'rgba(0,0,0,0.95)' };
    } else if (bgSetting.type === 'image' && bgSetting.imageUrl) {
      return {
        backgroundImage: `url(${bgSetting.imageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      };
      }
    }
    return {};
  };
  
  // Get border style for layout container
  const getLayoutBorderStyle = () => {
    if (contentType === 'poll') {
      const poll = activeContent as Poll;
    let borderSetting;
    if (layoutStyle === 1) {
        borderSetting = poll?.borderSettings?.fullScreen;
    } else if (layoutStyle === 2) {
        borderSetting = poll?.borderSettings?.lowerThird;
      } else {
        borderSetting = poll?.borderSettings?.pip;
      }
      
      // Special handling for lower third - default to line border
      if (layoutStyle === 2) {
        // Lower third border types: 'line' or 'boxEdge'
        const borderType = (borderSetting as any)?.type || borderSetting?.position || 'line';
        // If thickness is explicitly set, use it (including 1px). Otherwise default to 3px if no border settings exist
        const hasBorderSettings = borderSetting && Object.keys(borderSetting).length > 0;
        const thickness = hasBorderSettings && borderSetting?.thickness !== undefined 
          ? borderSetting.thickness 
          : (hasBorderSettings ? 0 : 3); // Default 3px only if no border settings at all
        const borderColor = poll.primaryColor || '#3B82F6';
        
        if (borderType === 'line') {
          // Top border only (line) - this is the default
          // Use box-shadow instead of border to avoid affecting content layout
          if (thickness > 0) {
            return {
              boxShadow: `0 -${thickness}px 0 0 ${borderColor}`,
            };
          }
          // No border if thickness is 0
          return {};
        } else if (borderType === 'boxEdge' || borderType === 'boxInner' || borderType === 'inner') {
          // Box Edge - full box border inset 10px from edges (all 4 sides: top, right, bottom, left)
          // Ensure minimum 1px visibility - if thickness is less than 1, use 1px for visibility
          const visibleThickness = Math.max(thickness, 1);
          // Check if we're at 100% zoom or above - if so, no margin for edge-to-edge
          const zoomPercent = (borderSetting as any)?.zoom !== undefined ? (borderSetting as any).zoom : 100;
          const isAt100PercentOrAbove = zoomPercent >= 100;
          return {
            // Only add margin when zoomed below 100% - at 100%+ we want edge-to-edge
            margin: isAt100PercentOrAbove ? '0' : '10px',
            // Explicitly set all 4 borders to ensure visibility
            borderTop: `${visibleThickness}px solid ${borderColor}`,
            borderRight: `${visibleThickness}px solid ${borderColor}`,
            borderBottom: `${visibleThickness}px solid ${borderColor}`,
            borderLeft: `${visibleThickness}px solid ${borderColor}`,
            boxSizing: 'border-box' as const,
            // Ensure borders are visible even at very thin sizes
            outline: 'none',
          };
    } else {
          // Default: no border if type is not recognized
          return {};
        }
      }
      
      // For full screen, render inner border using inset box-shadow (Border On) or no border (Border Off)
      if (layoutStyle === 1) {
        if (!borderSetting || !borderSetting.thickness || borderSetting.thickness === 0) {
          return {}; // No border (Border Off)
        }
        
        // For Full Screen, use inner border (inset box-shadow) for Border On
        const thickness = borderSetting.thickness;
        const borderColor = poll.primaryColor || '#3B82F6';
        
        // Render inner border using inset box-shadow
        return {
          boxShadow: `inset 0 0 0 ${thickness}px ${borderColor}`,
        };
      }
      
      // For PIP, render outer border using actual border property (not box-shadow to avoid double borders)
      if (layoutStyle === 3) {
        // Check if border is explicitly set to 0 or not set
        if (!borderSetting || borderSetting.thickness === undefined || borderSetting.thickness === 0) {
          return {}; // No border - empty object
        }
        
        // For PIP, always use outer border (CSS border, not box-shadow)
        const thickness = borderSetting.thickness;
        const borderColor = poll.primaryColor || '#3B82F6';
        
        // Only render outer border for PIP (inner position should still render as outer since we're handling it here)
        return {
          border: `${thickness}px solid ${borderColor}`,
        };
      }
      
      return {};
    } else if (contentType === 'qa') {
      const qa = activeContent as QandA;
      let borderSetting;
      if (layoutStyle === 1) {
        borderSetting = qa?.borderSettings?.fullScreen;
      } else if (layoutStyle === 2) {
        borderSetting = qa?.borderSettings?.lowerThird;
      } else if (layoutStyle === 3) {
        borderSetting = qa?.borderSettings?.pip;
      } else {
        borderSetting = qa?.borderSettings?.splitScreen;
      }
      
      // Special handling for lower third - default to line border
      if (layoutStyle === 2) {
        // Lower third border types: 'line' or 'boxEdge'
        const borderType = (borderSetting as any)?.type || borderSetting?.position || 'line';
        // If thickness is explicitly set, use it (including 1px). Otherwise default to 3px if no border settings exist
        const hasBorderSettings = borderSetting && Object.keys(borderSetting).length > 0;
        const thickness = hasBorderSettings && borderSetting?.thickness !== undefined 
          ? borderSetting.thickness 
          : (hasBorderSettings ? 0 : 3); // Default 3px only if no border settings at all
        const borderColor = qa.primaryColor || '#3B82F6';
        
        if (borderType === 'line') {
          // Top border only (line) - this is the default
          // Use box-shadow instead of border to avoid affecting content layout
          if (thickness > 0) {
            return {
              boxShadow: `0 -${thickness}px 0 0 ${borderColor}`,
            };
          }
          // No border if thickness is 0
          return {};
        } else if (borderType === 'boxEdge' || borderType === 'boxInner' || borderType === 'inner') {
          // Box Edge - full box border inset 10px from edges (all 4 sides: top, right, bottom, left)
          // Ensure minimum 1px visibility - if thickness is less than 1, use 1px for visibility
          const visibleThickness = Math.max(thickness, 1);
          // Check if we're at 100% zoom or above - if so, no margin for edge-to-edge
          const zoomPercent = (borderSetting as any)?.zoom !== undefined ? (borderSetting as any).zoom : 100;
          const isAt100PercentOrAbove = zoomPercent >= 100;
          return {
            // Only add margin when zoomed below 100% - at 100%+ we want edge-to-edge
            margin: isAt100PercentOrAbove ? '0' : '10px',
            // Explicitly set all 4 borders to ensure visibility
            borderTop: `${visibleThickness}px solid ${borderColor}`,
            borderRight: `${visibleThickness}px solid ${borderColor}`,
            borderBottom: `${visibleThickness}px solid ${borderColor}`,
            borderLeft: `${visibleThickness}px solid ${borderColor}`,
            boxSizing: 'border-box' as const,
            // Ensure borders are visible even at very thin sizes
            outline: 'none',
          };
        } else {
          // Default: no border if type is not recognized
          return {};
        }
      }
      
      // For full screen Q&A, render inner border using inset box-shadow (Border On) or no border (Border Off)
      if (layoutStyle === 1) {
        if (!borderSetting || !borderSetting.thickness || borderSetting.thickness === 0) {
          return {}; // No border (Border Off)
        }
        
        // For Full Screen Q&A, use inner border (inset box-shadow) for Border On
        const thickness = borderSetting.thickness;
        const borderColor = qa.primaryColor || '#3B82F6';
        
        // Render inner border using inset box-shadow
        return {
          boxShadow: `inset 0 0 0 ${thickness}px ${borderColor}`,
        };
      }
      
      // For PIP Q&A (layout 3)
      if (layoutStyle === 3) {
    if (!borderSetting || !borderSetting.thickness || borderSetting.thickness === 0) {
      return {};
    }
    
    const thickness = borderSetting.thickness;
    const position = borderSetting.position || 'outer';
        const borderColor = qa.primaryColor || '#3B82F6';
    
    if (position === 'inner') {
      return { boxShadow: `inset 0 0 0 ${thickness}px ${borderColor}` };
    } else {
      return { boxShadow: `0 0 0 ${thickness}px ${borderColor}` };
    }
      }
      
      // For true Split Screen Q&A (layout 4)
      if (layoutStyle === 4) {
    if (!borderSetting || !borderSetting.thickness || borderSetting.thickness === 0) {
      return {};
    }
    
    const thickness = borderSetting.thickness;
    const position = borderSetting.position || 'outer';
        const borderColor = qa.primaryColor || '#3B82F6';
    
    if (position === 'inner') {
      return { boxShadow: `inset 0 0 0 ${thickness}px ${borderColor}` };
    } else {
      return { boxShadow: `0 0 0 ${thickness}px ${borderColor}` };
    }
      }
      
      return {};
    }
    return {};
  };

  const layoutBgStyle = getLayoutBackgroundStyle();
  const layoutBorderStyle = getLayoutBorderStyle();
  const primaryColor = contentType === 'poll' 
    ? (activeContent as Poll).primaryColor || '#3B82F6'
    : (activeContent as QandA).primaryColor || '#3B82F6';

  // Render content based on type
  const renderContent = () => {
    if (contentType === 'poll') {
      return <PollDisplay poll={activeContent as Poll} disableBackground={true} />;
    } else if (contentType === 'qa') {
      return <QADisplay qa={activeContent as QandA} disableBackground={true} />;
    }
    return null;
  };

  return (
    <div className="fixed inset-0 bg-black overflow-hidden hide-scrollbar" style={{ overflow: 'hidden' }}>
          {layoutStyle === 1 ? (
        /* Full Screen Layout */
        <div
          className="relative w-full h-full hide-scrollbar"
          style={{
            width: `${BASE_WIDTH}px`,
            height: `${BASE_HEIGHT}px`,
            transform: `scale(${scaleFactor})`,
            transformOrigin: 'center center',
            overflow: 'hidden',
            position: 'absolute',
            left: '50%',
            top: '50%',
            marginLeft: `-${BASE_WIDTH / 2}px`,
            marginTop: `-${BASE_HEIGHT / 2}px`,
          }}
        >
          {/* Background layer - animates first if enabled */}
          <div
            className={`absolute inset-0 transition-all duration-500 ${
              animationSettings.backgroundAnimateFirst && isVisible
                ? 'opacity-100'
                : !animationSettings.backgroundAnimateFirst
                ? (isVisible ? 'opacity-100' : 'opacity-0')
                : 'opacity-0'
            }`}
            style={{
              width: `${BASE_WIDTH}px`,
              height: `${BASE_HEIGHT}px`,
              zIndex: 0,
              ...layoutBgStyle,
              ...layoutBorderStyle,
              ...(contentType === 'poll' && layoutStyle === 1 && (activeContent as Poll).borderRadius ? {
                borderRadius: `${(activeContent as Poll).borderRadius}px`,
              } : {}),
              ...(contentType === 'qa' && layoutStyle === 1 && (activeContent as QandA).borderRadius ? {
                borderRadius: `${(activeContent as QandA).borderRadius}px`,
              } : {}),
            }}
          />
          {/* Content layer: in = keyframe, out = transition via inline style (avoids Tailwind purging dynamic classes) */}
          <div
            className={`absolute inset-0 flex items-center justify-center hide-scrollbar ${
              isVisible ? getTransitionInClass(animationSettings.animationInType) : 'transition-all duration-500 ease-out'
            }`}
            style={{
              width: `${BASE_WIDTH}px`,
              height: `${BASE_HEIGHT}px`,
              zIndex: 1,
              background: 'transparent',
              transitionDelay: animationSettings.backgroundAnimateFirst && isVisible ? '300ms' : '0ms',
              ...(isVisible ? {} : getAnimationOutStyle(animationSettings.animationOutType)),
              ...(isVisible ? (() => {
                if (contentType === 'poll') {
                  const poll = activeContent as Poll;
                  const zoom = poll.borderSettings?.fullScreen?.zoom;
                  if (zoom && zoom !== 100) {
                    return {
                      transform: `scale(${zoom / 100})`,
                      transformOrigin: 'center center',
                    };
                  }
                } else if (contentType === 'qa') {
                  const qa = activeContent as QandA;
                  const zoom = qa.borderSettings?.fullScreen?.zoom;
                  if (zoom && zoom !== 100) {
                    return {
                      transform: `scale(${zoom / 100})`,
                      transformOrigin: 'center center',
                    };
                  }
                }
                return {};
              })() : {}),
            }}
          >
            {renderContent()}
          </div>
            </div>
          ) : layoutStyle === 2 ? (
        /* Lower Third - EXACT match to Event page: 960x540, absolute bottom-0 left-0 right-0, content-sized strip */
        (() => {
          let borderSetting;
          if (contentType === 'poll') borderSetting = (activeContent as Poll)?.borderSettings?.lowerThird;
          else borderSetting = (activeContent as QandA)?.borderSettings?.lowerThird;
          const borderType = (borderSetting as any)?.type || borderSetting?.position || 'line';
          const hasBoxEdge = borderType === 'boxEdge' || borderType === 'boxInner' || borderType === 'inner';
          const zoomPercent = (hasBoxEdge && (borderSetting as any)?.zoom !== undefined) ? (borderSetting as any).zoom : 100;
          const zoomScale = zoomPercent / 100;
          const yPosition = (hasBoxEdge && (borderSetting as any)?.yPosition != null) ? (borderSetting as any).yPosition : 0;
          const shouldZoom = hasBoxEdge && zoomPercent !== 100;

          return (
            <div
              style={{
                width: `${BASE_WIDTH}px`,
                height: `${BASE_HEIGHT}px`,
                transform: `scale(${scaleFactor})`,
                transformOrigin: 'center center',
                overflow: 'hidden',
                position: 'absolute',
                left: '50%',
                top: '50%',
                marginLeft: `-${BASE_WIDTH / 2}px`,
                marginTop: `-${BASE_HEIGHT / 2}px`,
              }}
            >
              {/* Event page: relative bg-black rounded-lg overflow-hidden 960x540 */}
              <div className="rounded-lg overflow-hidden" style={{ position: 'relative', width: `${BASE_WIDTH}px`, height: `${BASE_HEIGHT}px`, background: '#000' }}>
                {/* Event page: absolute bottom-0 left-0 right-0 - NO fixed height, sizes to content */}
                <div
                  className={`${animationSettings.backgroundAnimateFirst && isVisible ? '' : !animationSettings.backgroundAnimateFirst ? (isVisible ? '' : 'opacity-0') : 'opacity-0'} ${isVisible ? getTransitionInClass(animationSettings.animationInType) : 'transition-all duration-500 ease-out'}`}
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    zIndex: 1,
                    ...(Object.keys(layoutBgStyle).length > 0 ? layoutBgStyle : { background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.85) 100%)' }),
                    ...layoutBorderStyle,
                    backdropFilter: 'blur(8px)',
                    marginBottom: `${-yPosition}px`,
                    ...(contentType === 'poll' && (activeContent as Poll).borderRadius ? { borderRadius: `${(activeContent as Poll).borderRadius}px` } : {}),
                    ...(contentType === 'qa' && (activeContent as QandA).borderRadius ? { borderRadius: `${(activeContent as QandA).borderRadius}px` } : {}),
                    ...(shouldZoom ? { transform: `scale(${zoomScale})`, transformOrigin: 'center center' } : {}),
                    transition: 'opacity 500ms',
                    transitionDelay: animationSettings.backgroundAnimateFirst && isVisible ? '300ms' : '0ms',
                    ...(isVisible ? {} : getAnimationOutStyle(animationSettings.animationOutType)),
                  }}
                >
                  {/* Event page: div with p-6 (24px padding) */}
                  <div style={{ padding: '24px' }}>
                    {renderContent()}
                  </div>
                </div>
              </div>
            </div>
          );
        })()
      ) : layoutStyle === 3 ? (
        /* PIP - EXACT match to Event page: 960x540, absolute w-96 left-6/right-6, top 24px */
        (() => {
          const pipSide = contentType === 'poll' ? (activeContent as Poll).pipPosition === 'left' : (activeContent as QandA).splitScreenPosition === 'left';
          let pipZoom = 100;
          let pipX = 0;
          let pipY = 0;
          if (contentType === 'poll') {
            const s = (activeContent as Poll)?.borderSettings?.pip;
            pipZoom = (s as any)?.zoom ?? 100;
            pipX = (s as any)?.xPosition ?? 0;
            pipY = (s as any)?.yPosition ?? 0;
          } else {
            const s = (activeContent as QandA)?.borderSettings?.pip;
            pipZoom = (s as any)?.zoom ?? 100;
            pipX = (s as any)?.xPosition ?? 0;
            pipY = (s as any)?.yPosition ?? 0;
          }
          const pipZoomScale = pipZoom / 100;
          const shouldPipZoom = pipZoom !== 100;
          const pipOutType = pipSide ? (animationSettings.animationOutType === 'slideLeft' ? 'slideLeft' : animationSettings.animationOutType) : (animationSettings.animationOutType === 'slideRight' ? 'slideRight' : animationSettings.animationOutType);

          // Event page: top: 24+yPosition, left: 24+xPosition (or right: 24-xPosition)
          const topStyle = `${24 + pipY}px`;
          const leftStyle = pipSide ? `${24 + pipX}px` : undefined;
          const rightStyle = pipSide ? undefined : `${24 - pipX}px`;

          const pipBoxStyle: React.CSSProperties = {
            position: 'absolute' as const,
            top: topStyle,
            width: '384px', // w-96 - matches Event page
            maxWidth: '35vw', // matches Event page max-w-[35vw] - keeps layout consistent when viewport changes
            maxHeight: '70vh', // matches Event page exactly - same space/layout format
            overflowY: 'auto' as const,
            ...(pipSide ? { left: leftStyle } : { right: rightStyle }),
            ...(Object.keys(layoutBgStyle).length > 0 ? layoutBgStyle : { background: 'rgba(0,0,0,0.95)' }),
            backdropFilter: 'blur(8px)',
            ...(contentType === 'poll'
              ? ((activeContent as Poll).borderSettings?.pip?.thickness === 0 ? {} : { border: `2px solid ${primaryColor}`, borderRadius: (activeContent as Poll).borderRadius ? `${(activeContent as Poll).borderRadius}px` : '12px' })
              : { borderRadius: (activeContent as QandA).borderRadius ? `${(activeContent as QandA).borderRadius}px` : '0' }),
            ...(shouldPipZoom ? { transform: `scale(${pipZoomScale})`, transformOrigin: pipSide ? 'left top' : 'right top' } : {}),
          };

          return (
            <div
              style={{
                width: `${BASE_WIDTH}px`,
                height: `${BASE_HEIGHT}px`,
                transform: `scale(${scaleFactor})`,
                transformOrigin: 'center center',
                overflow: 'hidden',
                position: 'absolute',
                left: '50%',
                top: '50%',
                marginLeft: `-${BASE_WIDTH / 2}px`,
                marginTop: `-${BASE_HEIGHT / 2}px`,
              }}
            >
              {/* Event page: relative bg-black rounded-lg overflow-hidden 960x540 */}
              <div className="rounded-lg overflow-hidden" style={{ position: 'relative', width: `${BASE_WIDTH}px`, height: `${BASE_HEIGHT}px`, background: '#000' }}>
                {/* Event page: absolute w-96 left-6 or right-6, top 24px, p-4 child */}
                <div
                  className={`${animationSettings.backgroundAnimateFirst && isVisible ? '' : !animationSettings.backgroundAnimateFirst ? (isVisible ? '' : 'opacity-0') : 'opacity-0'} ${isVisible ? getTransitionInClass(animationSettings.animationInType) : 'transition-all duration-500 ease-out'}`}
                  style={{
                    ...pipBoxStyle,
                    zIndex: 1,
                    transition: 'opacity 500ms',
                    transitionDelay: animationSettings.backgroundAnimateFirst && isVisible ? '300ms' : '0ms',
                    ...(isVisible ? {} : getAnimationOutStyle(pipOutType)),
                  }}
                >
                  {/* Event page: div with p-4 (16px padding) */}
                  <div style={{ padding: contentType === 'poll' ? '16px' : '32px' }}>
                    {renderContent()}
                  </div>
                </div>
              </div>
            </div>
          );
        })()
      ) : (
        /* Layout 4: Split Screen - Left/Right split (for Q&A only) */
        (() => {
          if (contentType !== 'qa') return null; // Only for Q&A
          
          const qa = activeContent as QandA;
          const splitScreenSide = qa.splitScreenSide || 'left';
          const splitScreenWidth = qa.splitScreenWidth || 'third';
          const splitScreenBorderSetting = qa.borderSettings?.splitScreen;
          const zoom = (splitScreenBorderSetting as any)?.zoom !== undefined ? (splitScreenBorderSetting as any).zoom : 100;
          const zoomScale = zoom / 100;
          const shouldZoom = zoom !== 100;
          const xPosition = (splitScreenBorderSetting as any)?.xPosition !== undefined && (splitScreenBorderSetting as any).xPosition !== null ? (splitScreenBorderSetting as any).xPosition : 0;
          const yPosition = (splitScreenBorderSetting as any)?.yPosition !== undefined && (splitScreenBorderSetting as any).yPosition !== null ? (splitScreenBorderSetting as any).yPosition : 0;
          
          // Split screen width: 1/3 or 1/2 of screen
          const splitWidth = splitScreenWidth === 'half' ? BASE_WIDTH / 2 : BASE_WIDTH / 3;
          
          return (
            <div
              className="relative w-full h-full hide-scrollbar"
              style={{
                width: `${splitWidth}px`,
                height: `${BASE_HEIGHT}px`,
                transform: shouldZoom ? `scale(${scaleFactor * zoomScale})` : `scale(${scaleFactor})`,
                transformOrigin: splitScreenSide === 'left' ? 'left center' : 'right center',
                overflow: 'hidden',
                position: 'absolute',
                top: '50%',
                ...(splitScreenSide === 'left' ? { left: `${xPosition}px` } : { right: `${xPosition}px` }),
                marginTop: `-${BASE_HEIGHT / 2}px`,
                ...(yPosition !== 0 ? { marginTop: `-${BASE_HEIGHT / 2 + yPosition}px` } : {}),
              }}
            >
          {/* Background layer */}
          <div
            className={`absolute inset-0 transition-all duration-500 ${
              animationSettings.backgroundAnimateFirst && isVisible
                ? 'opacity-100'
                : !animationSettings.backgroundAnimateFirst
                ? (isVisible ? 'opacity-100' : 'opacity-0')
                : 'opacity-0'
            }`}
            style={{
              width: `${splitWidth}px`,
              height: `${BASE_HEIGHT}px`,
              zIndex: 0,
              ...(Object.keys(layoutBgStyle).length > 0
                ? layoutBgStyle
                : {
                    background: 'rgba(0,0,0,0.95)',
                  }),
              ...layoutBorderStyle,
              backdropFilter: 'blur(8px)',
              borderRadius: qa.borderRadius ? `${qa.borderRadius}px` : '0',
            }}
          />
          {/* Content layer: in = keyframe, out = transition via inline style */}
          {(() => {
            const splitOutType = splitScreenSide === 'left' ? (animationSettings.animationOutType === 'slideLeft' ? 'slideLeft' : animationSettings.animationOutType) : (animationSettings.animationOutType === 'slideRight' ? 'slideRight' : animationSettings.animationOutType);
            return (
          <div
            className={`absolute inset-0 hide-scrollbar ${
              isVisible ? getTransitionInClass(animationSettings.animationInType) : 'transition-all duration-500 ease-out'
            }`}
            style={{
              width: `${splitWidth}px`,
              height: `${BASE_HEIGHT}px`,
              zIndex: 1,
              background: 'transparent',
              transitionDelay: animationSettings.backgroundAnimateFirst && isVisible ? '300ms' : '0ms',
              padding: '32px',
              ...(isVisible ? {} : getAnimationOutStyle(splitOutType)),
            }}
          >
            {renderContent()}
          </div>
            );
          })()}
        </div>
          );
        })()
      )}
    </div>
  );
}
