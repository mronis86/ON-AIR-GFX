import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { getEvent, getPollsByEvent, getQAsByEvent, getQAsByStatus } from '../services/firestore';
import type { Event, Poll, QandA } from '../types';
import PollDisplay from '../components/PollDisplay';
import QADisplay from '../components/QADisplay';
import { getAnimationSettings, getAnimationClasses, getTransitionInClass, afterDelayThenPaint } from '../utils/animations';
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
        
        // For Q&A questions without outputSettings, copy from parent session
        const qaSessions = qasData.filter(qa => qa.name && !qa.question);
        const qaQuestions = qasData.filter(qa => qa.question && !qa.name);
        const qaQuestionsWithSettings = qaQuestions.map(qa => {
          if (!qa.outputSettings) {
            const parentSession = qaSessions.find(session => session.eventId === qa.eventId);
            if (parentSession?.outputSettings) {
              return { ...qa, outputSettings: parentSession.outputSettings };
            }
          }
          return qa;
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
        
        // For Q&A questions without outputSettings, copy from parent session
        const qaSessions = qasData.filter(qa => qa.name && !qa.question);
        const qaQuestions = qasData.filter(qa => qa.question && !qa.name);
        const qaQuestionsWithSettings = qaQuestions.map(qa => {
          if (!qa.outputSettings) {
            const parentSession = qaSessions.find(session => session.eventId === qa.eventId);
            if (parentSession?.outputSettings) {
              return { ...qa, outputSettings: parentSession.outputSettings };
            }
          }
          return qa;
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
          {/* Content layer: in = keyframe animation, out = transition (no key to avoid remount flicker) */}
          <div
            className={`absolute inset-0 flex items-center justify-center hide-scrollbar ${
              isVisible ? getTransitionInClass(animationSettings.animationInType) : `transition-all duration-500 ${getAnimationClasses(false, animationSettings.animationInType)}`
            }`}
            style={{
              width: `${BASE_WIDTH}px`,
              height: `${BASE_HEIGHT}px`,
              zIndex: 1,
              background: 'transparent',
              transitionDelay: animationSettings.backgroundAnimateFirst && isVisible ? '300ms' : '0ms',
              ...(isVisible ? {} : { opacity: 0 }),
              ...(() => {
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
              })(),
            }}
          >
            {renderContent()}
          </div>
            </div>
          ) : layoutStyle === 2 ? (
        /* Lower Third Layout - Fixed height (1/3 of screen) at bottom */
        (() => {
          // Get zoom setting for Box Edge
          let borderSetting;
          if (contentType === 'poll') {
            borderSetting = (activeContent as Poll)?.borderSettings?.lowerThird;
          } else {
            borderSetting = (activeContent as QandA)?.borderSettings?.lowerThird;
          }
          const borderType = (borderSetting as any)?.type || borderSetting?.position || 'line';
          // Get zoom percentage (70-110, default 100) - this scales everything proportionally
          // Only apply zoom if Box Edge is selected AND zoom is explicitly set
          const hasBoxEdge = borderType === 'boxEdge' || borderType === 'boxInner' || borderType === 'inner';
          const zoomPercent = (hasBoxEdge && (borderSetting as any)?.zoom !== undefined) ? (borderSetting as any).zoom : 100;
          const zoomScale = zoomPercent / 100; // Convert to scale factor (0.7 to 1.1)
          
          // Get Y position offset (vertical adjustment) - default 0
          // If yPosition is explicitly 0, use it; if undefined/null, default to 0; only use value if it exists and is not null/undefined
          const yPosition = (hasBoxEdge && (borderSetting as any)?.yPosition !== undefined && (borderSetting as any)?.yPosition !== null) 
            ? (borderSetting as any).yPosition 
            : 0;
          
          // Apply zoom to scale everything inside proportionally (text, bars, borders, everything)
          // Only apply zoom transform if zoom is different from 100%
          const shouldZoom = hasBoxEdge && zoomPercent !== 100;
          
          // When scaling from center, the element shrinks from its center point
          // To keep it anchored at the bottom, we need to adjust the bottom position
          // The height reduction is: originalHeight * (1 - zoomScale)
          // Since we scale from center, we adjust by half that amount
          // Only adjust if we're actually zooming
          const baseHeight = BASE_HEIGHT / 3;
          const originalScaledHeight = baseHeight * scaleFactor;
          const zoomedScaledHeight = shouldZoom ? originalScaledHeight * zoomScale : originalScaledHeight;
          const heightReduction = originalScaledHeight - zoomedScaledHeight;
          // At 100% zoom (shouldZoom = false), bottom should be exactly 0 + yPosition adjustment
          // When zoomed, adjust by half the height reduction to compensate for center scaling
          // Ensure yPosition is treated as 0 if undefined/null (including when explicitly 0)
          const actualYPosition = yPosition || 0; // Default to 0 if undefined/null/0
          const lineOffset = 25; // Lower the line by 25px (move container up by 25px, so add to bottom)
          const bottomAdjustment = shouldZoom 
            ? (heightReduction / 2) - (actualYPosition * scaleFactor) + (lineOffset * scaleFactor)
            : -actualYPosition + lineOffset; // At 100%, add line offset to move container up (line appears lower)
          
          return (
            <div
              className="relative w-full h-full hide-scrollbar"
              style={{
                width: shouldZoom ? `${BASE_WIDTH}px` : '100%', // Full width at 100%, fixed width when zoomed
                height: `${baseHeight}px`, // Fixed to 1/3 of base height
                transform: shouldZoom ? `scale(${zoomScale})` : undefined, // Apply zoom transform when not 100%
                transformOrigin: shouldZoom ? 'center center' : undefined, // Scale from center anchor point when zooming
                overflow: 'hidden',
                position: 'absolute',
                left: shouldZoom ? '50%' : '0', // Left edge at 100%, center when zoomed
                right: shouldZoom ? undefined : '0', // Right edge at 100% (for edge-to-edge)
                bottom: `${bottomAdjustment}px`, // Bottom edge - lowered by 25px, adjusted when zoomed
                marginLeft: shouldZoom ? `-${BASE_WIDTH / 2}px` : '0', // Center offset when zoomed, no margin at 100%
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
              width: '100%', // Full width of parent container
              height: `${baseHeight}px`,
              zIndex: 0,
              ...(Object.keys(layoutBgStyle).length > 0
                ? layoutBgStyle
                : {
                  background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.85) 100%)',
                }),
                ...layoutBorderStyle,
                backdropFilter: 'blur(8px)',
                ...(contentType === 'poll' && layoutStyle === 2 && (activeContent as Poll).borderRadius ? {
                  borderRadius: `${(activeContent as Poll).borderRadius}px`,
                } : {}),
                ...(contentType === 'qa' && layoutStyle === 2 && (activeContent as QandA).borderRadius ? {
                  borderRadius: `${(activeContent as QandA).borderRadius}px`,
                } : {}),
            }}
          />
          {/* Content layer: in = keyframe, out = transition */}
          <div
            className={`absolute inset-0 hide-scrollbar ${
              isVisible ? getTransitionInClass(animationSettings.animationInType) : `transition-all duration-500 ${getAnimationClasses(false, animationSettings.animationInType)}`
            }`}
            style={{
              width: '100%',
              height: `${baseHeight}px`,
              zIndex: 1,
              background: 'transparent',
              transitionDelay: animationSettings.backgroundAnimateFirst && isVisible ? '300ms' : '0ms',
              padding: (layoutBorderStyle as any)?.padding ? undefined : (shouldZoom ? '24px' : '24px'),
              ...(isVisible ? {} : { opacity: 0 }),
            }}
          >
            {renderContent()}
              </div>
            </div>
          );
        })()
      ) : layoutStyle === 3 ? (
        /* PIP Layout - Side box (for polls and Q&A layout 3) */
        (() => {
          // Get PIP zoom and positioning settings
          let pipZoom = 100;
          let pipXPosition = 0;
          let pipYPosition = 0;
          if (contentType === 'poll') {
            const pipBorderSetting = (activeContent as Poll)?.borderSettings?.pip;
            pipZoom = (pipBorderSetting as any)?.zoom !== undefined ? (pipBorderSetting as any).zoom : 100;
            pipXPosition = (pipBorderSetting as any)?.xPosition !== undefined && (pipBorderSetting as any).xPosition !== null ? (pipBorderSetting as any).xPosition : 0;
            pipYPosition = (pipBorderSetting as any)?.yPosition !== undefined && (pipBorderSetting as any).yPosition !== null ? (pipBorderSetting as any).yPosition : 0;
          } else if (contentType === 'qa') {
            const pipBorderSetting = (activeContent as QandA)?.borderSettings?.pip;
            pipZoom = (pipBorderSetting as any)?.zoom !== undefined ? (pipBorderSetting as any).zoom : 100;
            pipXPosition = (pipBorderSetting as any)?.xPosition !== undefined && (pipBorderSetting as any).xPosition !== null ? (pipBorderSetting as any).xPosition : 0;
            pipYPosition = (pipBorderSetting as any)?.yPosition !== undefined && (pipBorderSetting as any).yPosition !== null ? (pipBorderSetting as any).yPosition : 0;
          }
          
          const pipZoomScale = pipZoom / 100;
          const shouldPipZoom = pipZoom !== 100;
          
          // Calculate base position
          const baseTop = contentType === 'poll' ? 24 : 0;
          const baseLeft = contentType === 'poll' && (activeContent as Poll).pipPosition === 'left' ? 24 : undefined;
          const baseRight = contentType === 'poll' && (activeContent as Poll).pipPosition === 'right' ? 24 : undefined;
          const baseLeftQA = contentType === 'qa' && (activeContent as QandA).splitScreenPosition === 'left' ? 0 : undefined;
          const baseRightQA = contentType === 'qa' && (activeContent as QandA).splitScreenPosition === 'right' ? 0 : undefined;
          
          // Apply X and Y position adjustments and zoom
          const finalTop = baseTop + pipYPosition;
          const finalLeft = baseLeft !== undefined ? baseLeft + pipXPosition : baseLeft;
          const finalRight = baseRight !== undefined ? baseRight - pipXPosition : baseRight;
          const finalLeftQA = baseLeftQA !== undefined ? baseLeftQA + pipXPosition : baseLeftQA;
          const finalRightQA = baseRightQA !== undefined ? baseRightQA - pipXPosition : baseRightQA;
          
          // Apply zoom to transform
          const finalTransform = shouldPipZoom 
            ? `scale(${scaleFactor * pipZoomScale})`
            : `scale(${scaleFactor})`;
          
          return (
            <div
              className="relative w-full h-full hide-scrollbar"
              style={{
                width: `${BASE_WIDTH}px`,
                height: `${BASE_HEIGHT}px`,
                transform: finalTransform,
                transformOrigin: contentType === 'poll' 
                  ? ((activeContent as Poll).pipPosition === 'left' ? 'left top' : 'right top')
                  : ((activeContent as QandA).splitScreenPosition === 'left' ? 'left center' : 'right center'),
                overflow: 'hidden',
                position: 'absolute',
                top: `${finalTop}px`,
                ...(contentType === 'poll'
                  ? (finalLeft !== undefined ? { left: `${finalLeft}px` } : { right: `${finalRight}px` })
                  : (finalLeftQA !== undefined ? { left: `${finalLeftQA}px` } : { right: `${finalRightQA}px` })),
                maxWidth: contentType === 'poll' ? '35vw' : '50vw',
                ...(contentType === 'qa' ? { height: '100%' } : {}),
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
              ...(Object.keys(layoutBgStyle).length > 0
                ? layoutBgStyle
                : {
                    background: 'rgba(0,0,0,0.95)',
                  }),
              ...(contentType === 'poll' ? {} : layoutBorderStyle),
              backdropFilter: 'blur(8px)',
              // Apply PIP border and borderRadius
              ...(contentType === 'poll' && layoutStyle === 3
                ? (() => {
                    const hasCustomBorder = layoutBorderStyle && Object.keys(layoutBorderStyle).length > 0 && (layoutBorderStyle as any).border;
                    const pipBorderSetting = (activeContent as Poll)?.borderSettings?.pip;
                    const borderThickness = pipBorderSetting?.thickness;
                    const isBorderOff = borderThickness === 0;
                    const pollBorderRadius = (activeContent as Poll).borderRadius ? `${(activeContent as Poll).borderRadius}px` : '12px';
                    
                    if (isBorderOff) {
                      return { borderRadius: pollBorderRadius };
                    } else if (hasCustomBorder) {
                      return { ...layoutBorderStyle, borderRadius: pollBorderRadius };
                    } else {
                      return { border: `2px solid ${primaryColor}`, borderRadius: pollBorderRadius };
                    }
                  })()
                : contentType === 'qa' && layoutStyle === 3
                ? (() => {
                    const qaBorderRadius = (activeContent as QandA).borderRadius ? `${(activeContent as QandA).borderRadius}px` : '0';
                    return { borderRadius: qaBorderRadius };
                  })()
                : {}),
            }}
          />
          {/* Content layer: in = keyframe, out = transition */}
          <div
            className={`absolute inset-0 hide-scrollbar ${
              isVisible
                ? getTransitionInClass(animationSettings.animationInType)
                : `transition-all duration-500 ${contentType === 'poll'
                  ? (activeContent as Poll).pipPosition === 'left'
                    ? getAnimationClasses(false, animationSettings.animationOutType === 'slideLeft' ? 'slideLeft' : animationSettings.animationOutType)
                    : getAnimationClasses(false, animationSettings.animationOutType === 'slideRight' ? 'slideRight' : animationSettings.animationOutType)
                  : (activeContent as QandA).splitScreenPosition === 'left'
                    ? getAnimationClasses(false, animationSettings.animationOutType === 'slideLeft' ? 'slideLeft' : animationSettings.animationOutType)
                    : getAnimationClasses(false, animationSettings.animationOutType === 'slideRight' ? 'slideRight' : animationSettings.animationOutType)}`
            }`}
            style={{
              width: `${BASE_WIDTH}px`,
              height: `${BASE_HEIGHT}px`,
              zIndex: 1,
              background: 'transparent',
              transitionDelay: animationSettings.backgroundAnimateFirst && isVisible ? '300ms' : '0ms',
              padding: contentType === 'poll' ? '16px' : '32px',
              ...(isVisible ? {} : { opacity: 0 }),
            }}
          >
            {renderContent()}
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
          {/* Content layer: in = keyframe, out = transition */}
          <div
            className={`absolute inset-0 hide-scrollbar ${
              isVisible
                ? getTransitionInClass(animationSettings.animationInType)
                : `transition-all duration-500 ${splitScreenSide === 'left'
                  ? getAnimationClasses(false, animationSettings.animationOutType === 'slideLeft' ? 'slideLeft' : animationSettings.animationOutType)
                  : getAnimationClasses(false, animationSettings.animationOutType === 'slideRight' ? 'slideRight' : animationSettings.animationOutType)}`
            }`}
            style={{
              width: `${splitWidth}px`,
              height: `${BASE_HEIGHT}px`,
              zIndex: 1,
              background: 'transparent',
              transitionDelay: animationSettings.backgroundAnimateFirst && isVisible ? '300ms' : '0ms',
              padding: '32px',
              ...(isVisible ? {} : { opacity: 0 }),
            }}
          >
            {renderContent()}
          </div>
        </div>
          );
        })()
      )}
    </div>
  );
}
