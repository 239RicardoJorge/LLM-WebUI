import { useState, useEffect, useCallback } from 'react';
import { ResponseProfile, SavedProfile } from '../types';

const PROFILES_KEY = 'ccs_response_profiles';
const ACTIVE_PROFILE_KEY = 'ccs_active_profile_id';

const DEFAULT_PROFILE_DATA: ResponseProfile = {
    faders: {
        comunicacao: {
            casual_formal: 2,
            curto_extenso: 2,
            reativo_proativo: 2,
            direto_didatico: 2,
            cauteloso_assertivo: 2,
            convencional_criativo: 2,
            frio_empatico: 2,
        },
        raciocinio: {
            pragmatico_rigoroso: 2,
            segue_questiona: 2,
            pede_assume: 2,
        },
    },
    regras: {
        nuncaMencionarIA: false,
        nuncaEmojis: false,
        nuncaInventarAPIs: true,
        nuncaSairDominio: false,
        nuncaOutroIdioma: true,
    },
    papel: 'assistente',
    escopo: {
        podeEscreverCodigo: true,
        podeRefatorar: true,
        podeExplicar: true,
        podeSugerirBibliotecas: true,
        podeOpinarArquitetura: true,
    },
    padroes: {
        comecarCom: 'direta',
        terminarCom: 'nada',
    },
};

const DEFAULT_PROFILE: SavedProfile = {
    id: 'default',
    name: 'Default',
    data: DEFAULT_PROFILE_DATA,
};

/**
 * Custom hook for managing Response Profiles with save/load/create/delete
 */
export function useResponseProfile() {
    // Load saved profiles from localStorage
    const [savedProfiles, setSavedProfiles] = useState<SavedProfile[]>(() => {
        try {
            const saved = localStorage.getItem(PROFILES_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed;
                }
            }
        } catch (e) {
            // Ignore
        }
        return [DEFAULT_PROFILE];
    });

    // Load active profile ID
    const [activeProfileId, setActiveProfileId] = useState<string>(() => {
        try {
            const saved = localStorage.getItem(ACTIVE_PROFILE_KEY);
            if (saved) return saved;
        } catch (e) {
            // Ignore
        }
        return 'default';
    });

    // Draft state for editing (not persisted until save)
    const [draftProfile, setDraftProfile] = useState<ResponseProfile>(() => {
        const active = savedProfiles.find(p => p.id === activeProfileId);
        return active ? { ...active.data } : { ...DEFAULT_PROFILE_DATA };
    });

    // Track if there are unsaved changes
    const [hasChanges, setHasChanges] = useState(false);

    // Persist profiles to localStorage
    useEffect(() => {
        try {
            localStorage.setItem(PROFILES_KEY, JSON.stringify(savedProfiles));
        } catch (e) {
            // Ignore
        }
    }, [savedProfiles]);

    // Persist active profile ID
    useEffect(() => {
        try {
            localStorage.setItem(ACTIVE_PROFILE_KEY, activeProfileId);
        } catch (e) {
            // Ignore
        }
    }, [activeProfileId]);

    // Get active profile
    const activeProfile = savedProfiles.find(p => p.id === activeProfileId) || savedProfiles[0];

    // Select a profile
    const selectProfile = useCallback((id: string) => {
        const profile = savedProfiles.find(p => p.id === id);
        if (profile) {
            setActiveProfileId(id);
            setDraftProfile({ ...profile.data });
            setHasChanges(false);
        }
    }, [savedProfiles]);

    // Update draft fader
    const setFader = (
        category: 'comunicacao' | 'raciocinio',
        key: string,
        value: number
    ) => {
        setDraftProfile(prev => ({
            ...prev,
            faders: {
                ...prev.faders,
                [category]: {
                    ...prev.faders[category],
                    [key]: Math.max(0, Math.min(4, value)),
                },
            },
        }));
        setHasChanges(true);
    };

    // Update draft regra
    const setRegra = (key: keyof ResponseProfile['regras'], value: boolean) => {
        setDraftProfile(prev => ({
            ...prev,
            regras: { ...prev.regras, [key]: value },
        }));
        setHasChanges(true);
    };

    // Update draft papel
    const setPapel = (papel: ResponseProfile['papel']) => {
        setDraftProfile(prev => ({ ...prev, papel }));
        setHasChanges(true);
    };

    // Update draft escopo
    const setEscopo = (key: keyof ResponseProfile['escopo'], value: boolean) => {
        setDraftProfile(prev => ({
            ...prev,
            escopo: { ...prev.escopo, [key]: value },
        }));
        setHasChanges(true);
    };

    // Update draft padrao
    const setPadrao = <K extends keyof ResponseProfile['padroes']>(
        key: K,
        value: ResponseProfile['padroes'][K]
    ) => {
        setDraftProfile(prev => ({
            ...prev,
            padroes: { ...prev.padroes, [key]: value },
        }));
        setHasChanges(true);
    };

    // Save current draft to active profile
    const saveProfile = useCallback(() => {
        setSavedProfiles(prev =>
            prev.map(p =>
                p.id === activeProfileId ? { ...p, data: { ...draftProfile } } : p
            )
        );
        setHasChanges(false);
    }, [activeProfileId, draftProfile]);

    // Cancel changes — revert draft to saved
    const cancelChanges = useCallback(() => {
        const profile = savedProfiles.find(p => p.id === activeProfileId);
        if (profile) {
            setDraftProfile({ ...profile.data });
        }
        setHasChanges(false);
    }, [savedProfiles, activeProfileId]);

    // Create new profile
    const createProfile = useCallback((name: string) => {
        const newId = `profile_${Date.now()}`;
        const newProfile: SavedProfile = {
            id: newId,
            name,
            data: { ...DEFAULT_PROFILE_DATA },
        };
        setSavedProfiles(prev => [...prev, newProfile]);
        setActiveProfileId(newId);
        setDraftProfile({ ...DEFAULT_PROFILE_DATA });
        setHasChanges(false);
        return newId;
    }, []);

    // Delete profile
    const deleteProfile = useCallback((id: string) => {
        if (id === 'default') return; // Can't delete default
        setSavedProfiles(prev => {
            const filtered = prev.filter(p => p.id !== id);
            if (filtered.length === 0) return [DEFAULT_PROFILE];
            return filtered;
        });
        if (activeProfileId === id) {
            setActiveProfileId('default');
            setDraftProfile({ ...DEFAULT_PROFILE_DATA });
            setHasChanges(false);
        }
    }, [activeProfileId]);

    // Rename profile
    const renameProfile = useCallback((id: string, name: string) => {
        setSavedProfiles(prev =>
            prev.map(p => (p.id === id ? { ...p, name } : p))
        );
    }, []);

    return {
        // Profiles
        savedProfiles,
        activeProfile,
        activeProfileId,
        selectProfile,
        createProfile,
        deleteProfile,
        renameProfile,
        // Draft editing
        draftProfile,
        hasChanges,
        setFader,
        setRegra,
        setPapel,
        setEscopo,
        setPadrao,
        saveProfile,
        cancelChanges,
    };
}
