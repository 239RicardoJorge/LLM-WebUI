import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ChevronDown, ChevronRight, MessageSquare, Trash2, Save } from 'lucide-react';
import { useResponseProfile } from '../../hooks/useResponseProfile';
import { ResponseProfile as ResponseProfileType } from '../../types';

// Fader configuration - inverted as requested
const FADER_CONFIG = {
    communication: [
        { key: 'casual_formal', left: 'Casual', right: 'Formal' },
        { key: 'curto_extenso', left: 'Verbose', right: 'Brief' },
        { key: 'reativo_proativo', left: 'Proactive', right: 'Reactive' },
        { key: 'direto_didatico', left: 'Didactic', right: 'Direct' },
        { key: 'cauteloso_assertivo', left: 'Cautious', right: 'Assertive' },
        { key: 'convencional_criativo', left: 'Creative', right: 'Standard' },
        { key: 'frio_empatico', left: 'Empathetic', right: 'Neutral' },
    ],
    reasoning: [
        { key: 'pragmatico_rigoroso', left: 'Pragmatic', right: 'Rigorous' },
        { key: 'segue_questiona', left: 'Questions', right: 'Follows' },
        { key: 'pede_assume', left: 'Asks', right: 'Assumes' },
    ],
} as const;

const RULES_CONFIG = [
    { key: 'nuncaMencionarIA', label: 'Never mention being an AI' },
    { key: 'nuncaEmojis', label: 'Never use emojis' },
    { key: 'nuncaInventarAPIs', label: 'Never invent APIs' },
    { key: 'nuncaSairDominio', label: 'Never leave domain' },
    { key: 'nuncaOutroIdioma', label: "Never switch user's language" },
] as const;

const DEFAULT_ROLES = [
    'Code Assistant',
    'Code Reviewer',
    'Software Architect',
    'Technical Tutor',
    'Consultant',
];

const DEFAULT_SCOPE_CAN = ['Write code', 'Refactor', 'Explain concepts', 'Suggest libraries'];
const DEFAULT_SCOPE_CANNOT = ['Execute code', 'Access internet', 'Modify files'];
const DEFAULT_START_WITH = ['Direct answer', 'Summary first', 'Diagnosis', 'Context recap'];
const DEFAULT_END_WITH = ['Follow-up question', 'Suggestion', 'Nothing', 'Action items'];

// 5-step slider: word —●—●—●— word
// Opacity gradually changes based on slider position
const Slider: React.FC<{
    left: string;
    right: string;
    value: number;
    onChange: (v: number) => void;
}> = ({ left, right, value, onChange }) => {
    const trackRef = useRef<HTMLDivElement>(null);

    const calculatePosition = useCallback((clientX: number) => {
        if (!trackRef.current) return value;
        const rect = trackRef.current.getBoundingClientRect();
        const x = clientX - rect.left;
        const percent = Math.max(0, Math.min(1, x / rect.width));
        return Math.round(percent * 4); // 0, 1, 2, 3, 4
    }, [value]);

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        const newValue = calculatePosition(e.clientX);
        if (newValue !== value) onChange(newValue);

        const handleMouseMove = (moveEvent: MouseEvent) => {
            onChange(calculatePosition(moveEvent.clientX));
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    // Gradual opacity: left side fades as value increases, right side fades as value decreases
    // At center (2), both sides have medium opacity
    const leftOpacity = 1 - (value / 4) * 0.7;  // 1.0 -> 0.3 as value goes 0->4
    const rightOpacity = 0.3 + (value / 4) * 0.7; // 0.3 -> 1.0 as value goes 0->4

    return (
        <div
            ref={trackRef}
            className="relative h-5 cursor-pointer flex items-center"
            onMouseDown={handleMouseDown}
        >
            {/* Left WORD (position 0) */}
            <span
                className="text-[10px] font-medium transition-all duration-300 cursor-pointer hover:text-[var(--text-primary)]"
                style={{
                    color: value === 0 ? 'var(--text-primary)' : 'var(--text-muted)',
                    opacity: value === 0 ? 1 : leftOpacity
                }}
                onClick={(e) => { e.stopPropagation(); onChange(0); }}
            >
                {left}
            </span>

            {/* Full track: line—dot—line—dot—line—dot—line */}
            <div className="flex-1 flex items-center mx-2">
                {/* Segment before dot 1 */}
                <div
                    className="flex-1 h-[1px] transition-opacity duration-300"
                    style={{ backgroundColor: 'var(--border-color)', opacity: leftOpacity }}
                />

                {/* Dot 1 */}
                <div
                    className={`rounded-full mx-1 transition-all duration-300 cursor-pointer ${value === 1 ? 'w-2 h-2 bg-[var(--text-primary)]' : 'w-1.5 h-1.5 bg-[var(--border-color)] hover:bg-[var(--text-muted)]'
                        }`}
                    style={{ opacity: value === 1 ? 1 : (value < 1 ? leftOpacity : rightOpacity) }}
                    onClick={(e) => { e.stopPropagation(); onChange(1); }}
                />

                {/* Segment between dot 1 and dot 2 */}
                <div
                    className="flex-1 h-[1px] transition-opacity duration-300"
                    style={{ backgroundColor: 'var(--border-color)', opacity: value <= 1 ? leftOpacity : rightOpacity }}
                />

                {/* Dot 2 (center) */}
                <div
                    className={`rounded-full mx-1 transition-all duration-300 cursor-pointer ${value === 2 ? 'w-2 h-2 bg-[var(--text-primary)]' : 'w-1.5 h-1.5 bg-[var(--border-color)] hover:bg-[var(--text-muted)]'
                        }`}
                    style={{ opacity: value === 2 ? 1 : 0.6 }}
                    onClick={(e) => { e.stopPropagation(); onChange(2); }}
                />

                {/* Segment between dot 2 and dot 3 */}
                <div
                    className="flex-1 h-[1px] transition-opacity duration-300"
                    style={{ backgroundColor: 'var(--border-color)', opacity: value >= 3 ? rightOpacity : leftOpacity }}
                />

                {/* Dot 3 */}
                <div
                    className={`rounded-full mx-1 transition-all duration-300 cursor-pointer ${value === 3 ? 'w-2 h-2 bg-[var(--text-primary)]' : 'w-1.5 h-1.5 bg-[var(--border-color)] hover:bg-[var(--text-muted)]'
                        }`}
                    style={{ opacity: value === 3 ? 1 : (value > 3 ? rightOpacity : leftOpacity) }}
                    onClick={(e) => { e.stopPropagation(); onChange(3); }}
                />

                {/* Segment after dot 3 (before right word) */}
                <div
                    className="flex-1 h-[1px] transition-opacity duration-300"
                    style={{ backgroundColor: 'var(--border-color)', opacity: rightOpacity }}
                />
            </div>

            {/* Right WORD (position 4) */}
            <span
                className="text-[10px] font-medium transition-all duration-300 cursor-pointer hover:text-[var(--text-primary)]"
                style={{
                    color: value === 4 ? 'var(--text-primary)' : 'var(--text-muted)',
                    opacity: value === 4 ? 1 : rightOpacity
                }}
                onClick={(e) => { e.stopPropagation(); onChange(4); }}
            >
                {right}
            </span>
        </div>
    );
};




// Compact Toggle
const Toggle: React.FC<{
    label: string;
    checked: boolean;
    onChange: (v: boolean) => void;
}> = ({ label, checked, onChange }) => (
    <label className="flex items-center gap-2 cursor-pointer group">
        <div
            className={`w-3.5 h-3.5 rounded-sm border transition-all duration-300 flex items-center justify-center ${checked
                ? 'bg-[var(--text-secondary)] border-[var(--text-secondary)]'
                : 'border-[var(--border-color)] group-hover:border-[var(--text-muted)]'
                }`}
            onClick={() => onChange(!checked)}
        >
            {checked && (
                <svg className="w-2.5 h-2.5 text-[var(--bg-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
            )}
        </div>
        <span className="text-[10px] text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors duration-300">
            {label}
        </span>
    </label>
);

// Unified Search Selector - model-style with delete per item, no "Active" label
const SearchSelector: React.FC<{
    items: string[];
    activeItem: string;
    onSelect: (item: string) => void;
    onDelete?: (item: string) => void;
    canDelete?: (item: string) => boolean;
    placeholder: string;
    searchQuery: string;
    setSearchQuery: (q: string) => void;
    onCreateNew?: (name: string) => void;
    label: string;
}> = ({ items, activeItem, onSelect, onDelete, canDelete, placeholder: _, searchQuery, setSearchQuery, onCreateNew, label }) => {
    const [isFocused, setIsFocused] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    const filteredItems = items.filter(item =>
        item.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const showDropdown = isFocused && (searchQuery.length > 0 || filteredItems.length > 0);

    useEffect(() => {
        setHighlightedIndex(0);
    }, [searchQuery]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedIndex(prev => Math.min(prev + 1, filteredItems.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (filteredItems.length > 0) {
                onSelect(filteredItems[highlightedIndex]);
                setSearchQuery('');
                inputRef.current?.blur();
            } else if (searchQuery.trim() && onCreateNew) {
                onCreateNew(searchQuery.trim());
                setSearchQuery('');
                inputRef.current?.blur();
            }
        } else if (e.key === 'Escape') {
            setSearchQuery('');
            inputRef.current?.blur();
        }
    };

    const handleSelect = (item: string) => {
        onSelect(item);
        setSearchQuery('');
        inputRef.current?.blur();
    };

    const handleDelete = (item: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (onDelete) {
            onDelete(item);
        }
    };

    return (
        <div className="space-y-2">
            <h3 className="text-[10px] font-bold tracking-widest uppercase text-[var(--text-muted)]">
                {label}
            </h3>
            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setTimeout(() => setIsFocused(false), 150)}
                    onKeyDown={handleKeyDown}
                    placeholder={activeItem}
                    className="w-full bg-[var(--bg-glass)] border border-[var(--border-color)] text-[var(--text-primary)] text-[11px] py-2.5 px-3 rounded-xl focus:outline-none focus:border-[var(--text-muted)] focus:shadow-[0_0_8px_var(--button-glow)] placeholder:text-[var(--text-secondary)] transition-all duration-500"
                />

                {/* Dropdown */}
                {showDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl shadow-lg z-50 max-h-48 overflow-y-auto">
                        {filteredItems.length > 0 ? (
                            filteredItems.map((item, index) => (
                                <div
                                    key={item}
                                    onClick={() => handleSelect(item)}
                                    className={`flex items-center justify-between px-3 py-2 cursor-pointer transition-all duration-200 first:rounded-t-xl last:rounded-b-xl ${index === highlightedIndex
                                        ? 'bg-[var(--bg-glass)] text-[var(--text-primary)]'
                                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-glass)] hover:text-[var(--text-primary)]'
                                        }`}
                                >
                                    <span className={`text-[11px] ${item === activeItem ? 'font-semibold text-[var(--text-primary)]' : ''}`}>
                                        {item}
                                    </span>
                                    {onDelete && canDelete && canDelete(item) && (
                                        <button
                                            onClick={(e) => handleDelete(item, e)}
                                            className="p-1 text-[var(--text-muted)] hover:text-red-400 transition-colors"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="px-3 py-2 text-[11px] text-[var(--text-muted)]">
                                {onCreateNew ? `Press Enter to create "${searchQuery}"` : 'No matches'}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

const ResponseProfile: React.FC = () => {
    const [isExpanded, setIsExpanded] = useState(() => {
        const saved = localStorage.getItem('ccs_response_profile_expanded');
        return saved === 'true';
    });
    const [animate, setAnimate] = useState(false);
    const [profileSearchQuery, setProfileSearchQuery] = useState('');
    const [roleSearchQuery, setRoleSearchQuery] = useState('');
    const [scopeCanQuery, setScopeCanQuery] = useState('');
    const [scopeCannotQuery, setScopeCannotQuery] = useState('');
    const [startWithQuery, setStartWithQuery] = useState('');
    const [endWithQuery, setEndWithQuery] = useState('');
    const [showCollapsedDropdown, setShowCollapsedDropdown] = useState(false);

    // Custom lists
    const [customRoles, setCustomRoles] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem('ccs_custom_roles');
            return saved ? JSON.parse(saved) : [];
        } catch { return []; }
    });
    const [scopeCanItems, setScopeCanItems] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem('ccs_scope_can');
            return saved ? JSON.parse(saved) : DEFAULT_SCOPE_CAN;
        } catch { return DEFAULT_SCOPE_CAN; }
    });
    const [scopeCannotItems, setScopeCannotItems] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem('ccs_scope_cannot');
            return saved ? JSON.parse(saved) : DEFAULT_SCOPE_CANNOT;
        } catch { return DEFAULT_SCOPE_CANNOT; }
    });
    const [startWithItems, setStartWithItems] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem('ccs_start_with');
            return saved ? JSON.parse(saved) : DEFAULT_START_WITH;
        } catch { return DEFAULT_START_WITH; }
    });
    const [endWithItems, setEndWithItems] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem('ccs_end_with');
            return saved ? JSON.parse(saved) : DEFAULT_END_WITH;
        } catch { return DEFAULT_END_WITH; }
    });

    // Current selections
    const [activeStartWith, setActiveStartWith] = useState<string>(() => {
        return localStorage.getItem('ccs_active_start_with') || 'Direct answer';
    });
    const [activeEndWith, setActiveEndWith] = useState<string>(() => {
        return localStorage.getItem('ccs_active_end_with') || 'Nothing';
    });
    const [activeScopeCan, setActiveScopeCan] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem('ccs_active_scope_can');
            return saved ? JSON.parse(saved) : ['Write code', 'Explain concepts'];
        } catch { return ['Write code', 'Explain concepts']; }
    });
    const [activeScopeCannot, setActiveScopeCannot] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem('ccs_active_scope_cannot');
            return saved ? JSON.parse(saved) : [];
        } catch { return []; }
    });

    const allRoles = [...DEFAULT_ROLES, ...customRoles];

    const {
        savedProfiles,
        activeProfile,
        selectProfile,
        createProfile,
        deleteProfile,
        draftProfile,
        hasChanges,
        setFader,
        setRegra,
        setPapel,
        saveProfile,
        cancelChanges,
    } = useResponseProfile();

    const toggleExpanded = () => {
        if (!isExpanded) setAnimate(true);
        const newState = !isExpanded;
        setIsExpanded(newState);
        setShowCollapsedDropdown(false); // Close dropdown when expanding
        localStorage.setItem('ccs_response_profile_expanded', String(newState));
    };

    // Close collapsed dropdown when clicking outside
    useEffect(() => {
        if (!showCollapsedDropdown) return;
        const handleClickOutside = () => setShowCollapsedDropdown(false);
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [showCollapsedDropdown]);

    // Profile management
    const handleDeleteProfile = (name: string) => {
        const profile = savedProfiles.find(p => p.name === name);
        if (profile && profile.id !== 'default') {
            deleteProfile(profile.id);
        }
    };
    const canDeleteProfile = (name: string) => {
        const profile = savedProfiles.find(p => p.name === name);
        return profile ? profile.id !== 'default' : false;
    };

    // Role management
    const handleSelectRole = (role: string) => {
        const roleMap: Record<string, ResponseProfileType['papel']> = {
            'Code Assistant': 'assistente',
            'Code Reviewer': 'revisor',
            'Software Architect': 'arquiteto',
            'Technical Tutor': 'tutor',
            'Consultant': 'consultor',
        };
        setPapel(roleMap[role] || 'assistente');
    };
    const handleCreateRole = (name: string) => {
        if (!allRoles.includes(name)) {
            const newRoles = [...customRoles, name];
            setCustomRoles(newRoles);
            localStorage.setItem('ccs_custom_roles', JSON.stringify(newRoles));
        }
        handleSelectRole(name);
    };
    const handleDeleteRole = (role: string) => {
        if (customRoles.includes(role)) {
            const newRoles = customRoles.filter(r => r !== role);
            setCustomRoles(newRoles);
            localStorage.setItem('ccs_custom_roles', JSON.stringify(newRoles));
        }
    };
    const canDeleteRole = (role: string) => customRoles.includes(role);

    // Scope Can management
    const handleSelectScopeCan = (item: string) => {
        if (!activeScopeCan.includes(item)) {
            const newActive = [...activeScopeCan, item];
            setActiveScopeCan(newActive);
            localStorage.setItem('ccs_active_scope_can', JSON.stringify(newActive));
        }
    };
    const handleCreateScopeCan = (name: string) => {
        if (!scopeCanItems.includes(name)) {
            const newItems = [...scopeCanItems, name];
            setScopeCanItems(newItems);
            localStorage.setItem('ccs_scope_can', JSON.stringify(newItems));
        }
        handleSelectScopeCan(name);
    };
    const handleDeleteScopeCan = (item: string) => {
        if (!DEFAULT_SCOPE_CAN.includes(item)) {
            const newItems = scopeCanItems.filter(i => i !== item);
            setScopeCanItems(newItems);
            localStorage.setItem('ccs_scope_can', JSON.stringify(newItems));
        }
        const newActive = activeScopeCan.filter(i => i !== item);
        setActiveScopeCan(newActive);
        localStorage.setItem('ccs_active_scope_can', JSON.stringify(newActive));
    };
    const canDeleteScopeCan = (item: string) => !DEFAULT_SCOPE_CAN.includes(item);

    // Scope Cannot management
    const handleSelectScopeCannot = (item: string) => {
        if (!activeScopeCannot.includes(item)) {
            const newActive = [...activeScopeCannot, item];
            setActiveScopeCannot(newActive);
            localStorage.setItem('ccs_active_scope_cannot', JSON.stringify(newActive));
        }
    };
    const handleCreateScopeCannot = (name: string) => {
        if (!scopeCannotItems.includes(name)) {
            const newItems = [...scopeCannotItems, name];
            setScopeCannotItems(newItems);
            localStorage.setItem('ccs_scope_cannot', JSON.stringify(newItems));
        }
        handleSelectScopeCannot(name);
    };
    const handleDeleteScopeCannot = (item: string) => {
        if (!DEFAULT_SCOPE_CANNOT.includes(item)) {
            const newItems = scopeCannotItems.filter(i => i !== item);
            setScopeCannotItems(newItems);
            localStorage.setItem('ccs_scope_cannot', JSON.stringify(newItems));
        }
        const newActive = activeScopeCannot.filter(i => i !== item);
        setActiveScopeCannot(newActive);
        localStorage.setItem('ccs_active_scope_cannot', JSON.stringify(newActive));
    };
    const canDeleteScopeCannot = (item: string) => !DEFAULT_SCOPE_CANNOT.includes(item);

    // Start With management
    const handleSelectStartWith = (item: string) => {
        setActiveStartWith(item);
        localStorage.setItem('ccs_active_start_with', item);
    };
    const handleCreateStartWith = (name: string) => {
        if (!startWithItems.includes(name)) {
            const newItems = [...startWithItems, name];
            setStartWithItems(newItems);
            localStorage.setItem('ccs_start_with', JSON.stringify(newItems));
        }
        handleSelectStartWith(name);
    };
    const handleDeleteStartWith = (item: string) => {
        if (!DEFAULT_START_WITH.includes(item)) {
            const newItems = startWithItems.filter(i => i !== item);
            setStartWithItems(newItems);
            localStorage.setItem('ccs_start_with', JSON.stringify(newItems));
        }
    };
    const canDeleteStartWith = (item: string) => !DEFAULT_START_WITH.includes(item);

    // End With management
    const handleSelectEndWith = (item: string) => {
        setActiveEndWith(item);
        localStorage.setItem('ccs_active_end_with', item);
    };
    const handleCreateEndWith = (name: string) => {
        if (!endWithItems.includes(name)) {
            const newItems = [...endWithItems, name];
            setEndWithItems(newItems);
            localStorage.setItem('ccs_end_with', JSON.stringify(newItems));
        }
        handleSelectEndWith(name);
    };
    const handleDeleteEndWith = (item: string) => {
        if (!DEFAULT_END_WITH.includes(item)) {
            const newItems = endWithItems.filter(i => i !== item);
            setEndWithItems(newItems);
            localStorage.setItem('ccs_end_with', JSON.stringify(newItems));
        }
    };
    const canDeleteEndWith = (item: string) => !DEFAULT_END_WITH.includes(item);

    const handleSave = () => {
        if (profileSearchQuery.trim()) {
            const existing = savedProfiles.find(p => p.name.toLowerCase() === profileSearchQuery.toLowerCase());
            if (existing) {
                selectProfile(existing.id);
            } else {
                createProfile(profileSearchQuery.trim());
            }
            setProfileSearchQuery('');
        }
        saveProfile();
    };

    const roleDisplayMap: Record<string, string> = {
        'assistente': 'Code Assistant',
        'revisor': 'Code Reviewer',
        'arquiteto': 'Software Architect',
        'tutor': 'Technical Tutor',
        'consultor': 'Consultant',
    };
    const currentRoleDisplay = roleDisplayMap[draftProfile.papel] || draftProfile.papel;

    // Generate prompt preview
    const generatePromptPreview = () => {
        const parts: string[] = [];

        parts.push(`Act as a ${currentRoleDisplay}.`);

        if (activeScopeCan.length > 0) {
            parts.push(`You can: ${activeScopeCan.join(', ')}.`);
        }
        if (activeScopeCannot.length > 0) {
            parts.push(`You cannot: ${activeScopeCannot.join(', ')}.`);
        }

        if (activeStartWith !== 'Direct answer') {
            parts.push(`Start your responses with: ${activeStartWith}.`);
        }
        if (activeEndWith !== 'Nothing') {
            parts.push(`End your responses with: ${activeEndWith}.`);
        }

        return parts.join(' ');
    };

    return (
        <div className="space-y-3 mt-6">
            {/* Header */}
            <button
                onClick={toggleExpanded}
                className="flex items-center gap-2 w-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors duration-500"
            >
                <MessageSquare className="w-3 h-3" />
                <span className="text-[10px] font-bold tracking-widest uppercase flex-1 text-left">
                    Response Profile
                </span>
                {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>

            {!isExpanded && (
                <div className="relative">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowCollapsedDropdown(!showCollapsedDropdown);
                        }}
                        className="w-full p-3 rounded-xl border text-left transition-all duration-500 bg-[var(--bg-glass)] border-[var(--border-color)] hover:border-[var(--button-glow)] hover:shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-4px_rgba(0,0,0,0.1),inset_0_0_8px_var(--button-glow)]"
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-[13px] font-medium text-[var(--text-primary)]">
                                {activeProfile?.name || 'Default'}
                            </span>
                            <ChevronDown className={`w-3 h-3 text-[var(--text-muted)] transition-transform duration-300 ${showCollapsedDropdown ? 'rotate-180' : ''}`} />
                        </div>
                        <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
                            {currentRoleDisplay}
                        </div>
                    </button>

                    {/* Dropdown for collapsed mode */}
                    {showCollapsedDropdown && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl shadow-lg z-50 max-h-48 overflow-y-auto">
                            {savedProfiles.map((profile) => (
                                <div
                                    key={profile.id}
                                    onClick={() => {
                                        selectProfile(profile.id);
                                        setShowCollapsedDropdown(false);
                                    }}
                                    className={`px-3 py-2 cursor-pointer transition-all duration-200 first:rounded-t-xl last:rounded-b-xl ${profile.id === activeProfile?.id
                                        ? 'bg-[var(--bg-glass)] text-[var(--text-primary)]'
                                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-glass)] hover:text-[var(--text-primary)]'
                                        }`}
                                >
                                    <span className={`text-[11px] ${profile.id === activeProfile?.id ? 'font-semibold' : ''}`}>
                                        {profile.name}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {isExpanded && (
                <div className={`space-y-5 ${animate ? 'animate-fade-up' : ''}`}>

                    {/* Profile */}
                    <SearchSelector
                        label="Profile"
                        items={savedProfiles.map(p => p.name)}
                        activeItem={activeProfile?.name || 'Default'}
                        onSelect={(name) => {
                            const profile = savedProfiles.find(p => p.name === name);
                            if (profile) selectProfile(profile.id);
                        }}
                        onDelete={handleDeleteProfile}
                        canDelete={canDeleteProfile}
                        placeholder={activeProfile?.name || 'Default'}
                        searchQuery={profileSearchQuery}
                        setSearchQuery={setProfileSearchQuery}
                        onCreateNew={(name) => createProfile(name)}
                    />

                    {/* Role */}
                    <SearchSelector
                        label="Role"
                        items={allRoles}
                        activeItem={currentRoleDisplay}
                        onSelect={handleSelectRole}
                        onDelete={handleDeleteRole}
                        canDelete={canDeleteRole}
                        placeholder={currentRoleDisplay}
                        searchQuery={roleSearchQuery}
                        setSearchQuery={setRoleSearchQuery}
                        onCreateNew={handleCreateRole}
                    />

                    {/* COMMUNICATION */}
                    <div className="space-y-1">
                        <h3 className="text-[10px] font-bold tracking-widest uppercase text-[var(--text-muted)] mb-3">
                            Communication
                        </h3>
                        {FADER_CONFIG.communication.map(({ key, left, right }) => (
                            <Slider
                                key={key}
                                left={left}
                                right={right}
                                value={Math.min(4, draftProfile.faders.comunicacao[key as keyof typeof draftProfile.faders.comunicacao])}
                                onChange={(v) => setFader('comunicacao', key, v)}
                            />
                        ))}
                    </div>

                    {/* REASONING */}
                    <div className="space-y-1">
                        <h3 className="text-[10px] font-bold tracking-widest uppercase text-[var(--text-muted)] mb-3">
                            Reasoning
                        </h3>
                        {FADER_CONFIG.reasoning.map(({ key, left, right }) => (
                            <Slider
                                key={key}
                                left={left}
                                right={right}
                                value={Math.min(4, draftProfile.faders.raciocinio[key as keyof typeof draftProfile.faders.raciocinio])}
                                onChange={(v) => setFader('raciocinio', key, v)}
                            />
                        ))}
                    </div>

                    {/* Rules */}
                    <div className="space-y-2">
                        <h3 className="text-[10px] font-bold tracking-widest uppercase text-[var(--text-muted)]">
                            Rules
                        </h3>
                        <div className="space-y-1.5">
                            {RULES_CONFIG.map(({ key, label }) => (
                                <Toggle
                                    key={key}
                                    label={label}
                                    checked={draftProfile.regras[key]}
                                    onChange={(v) => setRegra(key, v)}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Scope - Separate lines */}
                    <div className="space-y-3">
                        <SearchSelector
                            label="+ Scope (Can Do)"
                            items={scopeCanItems}
                            activeItem={activeScopeCan.join(', ') || 'Add...'}
                            onSelect={handleSelectScopeCan}
                            onDelete={handleDeleteScopeCan}
                            canDelete={canDeleteScopeCan}
                            placeholder="Add capability..."
                            searchQuery={scopeCanQuery}
                            setSearchQuery={setScopeCanQuery}
                            onCreateNew={handleCreateScopeCan}
                        />

                        {/* Active can tags */}
                        {activeScopeCan.length > 0 && (
                            <div className="flex flex-wrap gap-1 -mt-1">
                                {activeScopeCan.map(item => (
                                    <span
                                        key={item}
                                        onClick={() => {
                                            const newActive = activeScopeCan.filter(i => i !== item);
                                            setActiveScopeCan(newActive);
                                            localStorage.setItem('ccs_active_scope_can', JSON.stringify(newActive));
                                        }}
                                        className="text-[9px] px-2 py-0.5 bg-green-500/10 text-green-400 border border-green-500/20 rounded cursor-pointer hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-colors"
                                    >
                                        + {item}
                                    </span>
                                ))}
                            </div>
                        )}

                        <SearchSelector
                            label="− Scope (Cannot Do)"
                            items={scopeCannotItems}
                            activeItem={activeScopeCannot.join(', ') || 'Add...'}
                            onSelect={handleSelectScopeCannot}
                            onDelete={handleDeleteScopeCannot}
                            canDelete={canDeleteScopeCannot}
                            placeholder="Add restriction..."
                            searchQuery={scopeCannotQuery}
                            setSearchQuery={setScopeCannotQuery}
                            onCreateNew={handleCreateScopeCannot}
                        />

                        {/* Active cannot tags */}
                        {activeScopeCannot.length > 0 && (
                            <div className="flex flex-wrap gap-1 -mt-1">
                                {activeScopeCannot.map(item => (
                                    <span
                                        key={item}
                                        onClick={() => {
                                            const newActive = activeScopeCannot.filter(i => i !== item);
                                            setActiveScopeCannot(newActive);
                                            localStorage.setItem('ccs_active_scope_cannot', JSON.stringify(newActive));
                                        }}
                                        className="text-[9px] px-2 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded cursor-pointer hover:bg-green-500/10 hover:text-green-400 hover:border-green-500/20 transition-colors"
                                    >
                                        − {item}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Patterns - Keep side by side */}
                    <div className="grid grid-cols-2 gap-3">
                        <SearchSelector
                            label="Start With"
                            items={startWithItems}
                            activeItem={activeStartWith}
                            onSelect={handleSelectStartWith}
                            onDelete={handleDeleteStartWith}
                            canDelete={canDeleteStartWith}
                            placeholder={activeStartWith}
                            searchQuery={startWithQuery}
                            setSearchQuery={setStartWithQuery}
                            onCreateNew={handleCreateStartWith}
                        />
                        <SearchSelector
                            label="End With"
                            items={endWithItems}
                            activeItem={activeEndWith}
                            onSelect={handleSelectEndWith}
                            onDelete={handleDeleteEndWith}
                            canDelete={canDeleteEndWith}
                            placeholder={activeEndWith}
                            searchQuery={endWithQuery}
                            setSearchQuery={setEndWithQuery}
                            onCreateNew={handleCreateEndWith}
                        />
                    </div>

                    {/* Save / Cancel */}
                    <div className="flex gap-2 pt-4 border-t border-[var(--border-color)]">
                        <button
                            onClick={() => { cancelChanges(); setProfileSearchQuery(''); setRoleSearchQuery(''); }}
                            disabled={!hasChanges && !profileSearchQuery && !roleSearchQuery}
                            className={`flex-1 py-2.5 rounded-lg text-[11px] font-medium transition-all duration-300 ${hasChanges || profileSearchQuery || roleSearchQuery
                                ? 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                : 'text-[var(--text-muted)] opacity-40 cursor-not-allowed'
                                }`}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!hasChanges && !profileSearchQuery}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-semibold border transition-all duration-500 ${hasChanges || profileSearchQuery
                                ? 'bg-[var(--bg-glass)] border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--button-glow)] hover:shadow-[inset_0_0_8px_var(--button-glow)]'
                                : 'border-transparent text-[var(--text-muted)] opacity-40 cursor-not-allowed'
                                }`}
                        >
                            <Save className="w-4 h-4" />
                            {profileSearchQuery && !savedProfiles.find(p => p.name.toLowerCase() === profileSearchQuery.toLowerCase())
                                ? 'Create'
                                : 'Save'
                            }
                        </button>
                    </div>

                    {/* Prompt Preview - like API keys tagline */}
                    <div className="text-center pt-4">
                        <p className="text-[9px] text-[var(--text-primary)] uppercase tracking-widest opacity-40 leading-loose">
                            {generatePromptPreview()}
                        </p>
                    </div>

                </div>
            )}
        </div>
    );
};

export default ResponseProfile;
