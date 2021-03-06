export interface SettingsData {
    last: number;
    webhookUrl: string;
    bounds: {
        top: number;
        bottom: number;
        left: number;
        right: number;
    };
}

export interface NodeMetadata {
    id: string;
    version: string;
    timestamp: string;
    uid: string;
    user: string;
    changeset: string;
    lat: string;
    lon: string;
}

export interface Node {
    $: NodeMetadata;
}

export interface NodeSet {
    node: Node[];
}

export interface SequenceXML {
    osmChange: {
        create: NodeSet[];
        modify: NodeSet[];
        delete: NodeSet[];
    };
}

export type FilteredNode = Pick<NodeMetadata, 'changeset' | 'timestamp'>;

export interface ChangesetElement {
    type: 'changeset';
    id: number;
    created_at: string;
    closed_at: string;
    open: boolean;
    user: string;
    uid: number;
    minlat: number;
    minlon: number;
    maxlat: number;
    maxlon: number;
    comments_count: number;
    changes_count: number;
    tags?: {
        [key: string]: string | undefined;
    };
}

export interface ChangesetDetailsResponse {
    version: string;
    generator: string;
    copyright: string;
    attribution: string;
    license: string;
    elements: {
        0: ChangesetElement;
    };
}

export type ChangesetDetails = {
    id: FilteredNode['changeset'];
    uid: ChangesetElement['uid'];
    username: ChangesetElement['user'];
    count: ChangesetElement['changes_count'];
    comment: string;
    time: FilteredNode['timestamp'];
};

export interface UserResponse {
    version: string;
    generator: string;
    copyright: string;
    attribution: string;
    license: string;
    user: {
        id: number;
        display_name: string;
        account_created: string;
        description: string;
        contributor_terms: {
            agreed: boolean;
        };
        img?: {
            href?: string;
        };
    };
}
