const get_TrackedSyntaxKind_None = () => 0;
const get_TrackedSyntaxKind_String = () => 1;
/** only multi-line-comments that span multiple lines are stored in EDITOR_trackedSyntaxList with the 'get_TrackedSyntaxKind_Comment()' */
const get_TrackedSyntaxKind_Comment = () => 2;

class TrackedSyntaxList {
    data_literal;
    capacity_literal;

    capacity_abstract;
    count_abstract = 0;

    // Storing the trackedSyntaxKind as an int32 isn't the most ideal thing in the world.
    // Previously the ints were being grouped via a class instance.
    // So this still ought to be better than what was done previously.
    field_count = 3;
    // this.trackedSyntaxKind = trackedSyntaxKind;
    // this.start = start;
    // this.length = length;

    trackedSyntaxKind_offset = 0;
    start_offset = 1;
    length_offset = 2;

    /**
     * If 'sourceUint32Array' is provided then 'initialCapacity_abstract' is ignored and all information is determined based on 'sourceUint32Array'.
     * 
     * If 'sourceUint32Array' is falsey, then a new Uint32Array is made determined by the 'initialCapacity_abstract'.
     */
    constructor(initialCapacity_abstract, sourceUint32Array) {
        if (sourceUint32Array) {

            if (sourceUint32Array.length % this.field_count !== 0) {
                throw new Error('mismatched field count');
            }

            initialCapacity_abstract = sourceUint32Array.length / this.field_count;

            let temp_capacity_literal = sourceUint32Array.length;
    
            // TODO: how important is a power of 2 capacity?
            this.data_literal = sourceUint32Array;
            
            this.capacity_abstract = initialCapacity_abstract;
            this.capacity_literal = temp_capacity_literal;
    
            this.count_abstract = initialCapacity_abstract;
        }
        else {
            let temp_capacity_literal = initialCapacity_abstract * this.field_count;
    
            this.data_literal = new Uint32Array(temp_capacity_literal);
            this.capacity_abstract = initialCapacity_abstract;
            this.capacity_literal = temp_capacity_literal;
    
            this.count_abstract = 0;
        }
    }

    /**
     * Does not clear the information, only sets 'this.count' to '0'.
     */
    clear() {
        this.count_abstract = 0;
    }

    /**
     * 
     * @param {TrackedSyntax} trackedSyntax a place to read the data into, since it is stored as just int32 data (not the class)
     * @returns {TrackedSyntax}
     */
    getElementAt(index_abstract) {
        let index_literal = index_abstract * this.field_count;
        EDITOR_pooledTrackedSyntax_trackedSyntaxKind = this.data_literal[index_literal + this.trackedSyntaxKind_offset];
        set_EDITOR_pooledTrackedSyntax_start(this.data_literal[index_literal + this.start_offset]);
        set_EDITOR_pooledTrackedSyntax_length(this.data_literal[index_literal + this.length_offset]);
    }

    getStart(index_abstract) {
        return this.data_literal[(index_abstract * this.field_count) + this.start_offset];
    }

    /**
     * TODO: This function has the 'index_abstract' as the first parameter,
     * meanwhile 'getElementAt(...)' takes this as second parameter.
     * A decision on a consistent position needs to be made.
     * @param {number} index_abstract 
     * @param {number} value 
     */
    setStart(index_abstract, value) {
        this.data_literal[(index_abstract * this.field_count) + this.start_offset] = value;
    }
    
    getLength(index_abstract) {
        return this.data_literal[(index_abstract * this.field_count) + this.length_offset];
    }
    
    /**
     * TODO: This function has the 'index_abstract' as the first parameter,
     * meanwhile 'getElementAt(...)' takes this as second parameter.
     * A decision on a consistent position needs to be made.
     * @param {number} index_abstract 
     * @param {number} value 
     */
    setLength(index_abstract, value) {
        this.data_literal[(index_abstract * this.field_count) + this.length_offset] = value;
    }
    
    /**
     * TODO: This function has the 'index_abstract' as the first parameter,
     * meanwhile 'getElementAt(...)' takes this as second parameter.
     * A decision on a consistent position needs to be made.
     * @param {number} index_abstract 
     * @param {number} value 
     */
    setTrackedSyntaxKind(index_abstract, value) {
        this.data_literal[(index_abstract * this.field_count) + this.trackedSyntaxKind_offset] = value;
    }

    /**
     * TODO: ensure all the parameters are encoded, especially because I'm noticing myself forgetting.
     */
    insert(index_abstract, trackedSyntaxKind, start, length) {
        this.ensureCapacityForInsertion(index_abstract, 1);

        let index_literal = index_abstract * this.field_count;

        if (index_abstract !== this.count_abstract) {
            this.copyTo(this.data_literal, index_abstract, this.data_literal, index_abstract + 1, this.count_abstract - index_abstract);
        }

        this.data_literal[index_literal + this.trackedSyntaxKind_offset] = trackedSyntaxKind;
        this.data_literal[index_literal + this.start_offset] = start;
        this.data_literal[index_literal + this.length_offset] = length;

        this.count_abstract++;
    }

    /**
     * Does not clear trailing information.
     * 
     * count === 0 immediately returns
     */
    removeAt(index_abstract, count_abstract) {

        if (index_abstract > this.count_abstract) { throw new Error('removeAt(...): index_abstract > this.count_abstract'); }
        if (index_abstract + count_abstract > this.count_abstract) { throw new Error('removeAt(...): index_abstract + count_abstract > this.count_abstract'); }
        if (count_abstract === 0) { return; }

        if (index_abstract + count_abstract === this.count_abstract) {
            let shiftableCount_abstract = this.count_abstract - (index_abstract + count_abstract);
            if (shiftableCount_abstract > 0) {
                this.copyTo(
                    this.data_literal,
                    index_abstract + count_abstract,
                    this.data_literal,
                    index_abstract,
                    shiftableCount_abstract);
            }
        }
        else {
            this.copyTo(
                this.data_literal,
                index_abstract + count_abstract,
                this.data_literal,
                index_abstract,
                this.count_abstract - (index_abstract + count_abstract));
        }

        this.count_abstract -= count_abstract;
    }

    /**
     * - If the size asked for cannot be allocated, an exception will be thrown. (presumably the wording "thrown by the runtime" is involved.)
     * - JavaScript numbers do not wrap around to negative values when the value is very large.
     *       They instead approach infinity and lose precision.
     *       - There still is a check for whether the new, expected to be larger, capacity is smaller for whatever reason.
     *         Since this ought to be a negligible check for this method to perform.
     *         And failure to catch that case if it happens is an infinite loop.
     */
    ensureCapacityForInsertion(index_abstract, count_abstract) {
        let capacityPrevious_abstract = this.capacity_abstract;
        while (true) {
            if (this.count_abstract + count_abstract > this.capacity_abstract) {
                this.doubleCapacity();
            }
            else if (index_abstract >= this.capacity_abstract) {
                this.doubleCapacity();
            }
            else {
                break;
            }

            if (this.capacity_abstract === capacityPrevious_abstract) {
                break;
            }
            if (this.capacity_abstract < capacityPrevious_abstract) {
                throw new Error('ensureCapacityForInsertion(...): this.capacity_abstract < capacityPrevious_abstract');
            }

            capacityPrevious_abstract = this.capacity_abstract;
        }
    }

    doubleCapacity() {
        let capacityNew_literal = this.capacity_literal * 2;
        let dataNew_literal = new Uint32Array(capacityNew_literal);
        this.copyTo(this.data_literal, 0, dataNew_literal, 0, this.count_abstract);
        this.data_literal = dataNew_literal;
        this.capacity_literal = capacityNew_literal;
        this.capacity_abstract *= 2;
    }

    /**
     * inclusive/exclusive
     */
    copyTo(dataSource_literal, sourceStart_abstract, dataDestination_literal, destinationStart_abstract, length_abstract) {

        if (dataSource_literal === dataDestination_literal) {
            if (dataSource_literal !== this.data_literal) {
                throw new Error('dataSource_literal === dataDestination_literal ; but dataSource_literal !== this.data_literal');
            }

            // TODO: use 'copyWithin' method here and other such locations

            let distance_abstract = destinationStart_abstract - sourceStart_abstract;

            if (distance_abstract > 0) {
                for (var i_abstract = sourceStart_abstract + length_abstract - 1; i_abstract >= sourceStart_abstract; i_abstract--) {
                    let iplusd_abstract = i_abstract + distance_abstract;
                    let iplusd_literal = iplusd_abstract * this.field_count;
                    let i_literal = i_abstract * this.field_count;
                    this.data_literal[iplusd_literal + this.trackedSyntaxKind_offset] = this.data_literal[i_literal + this.trackedSyntaxKind_offset];
                    this.data_literal[iplusd_literal + this.start_offset] = this.data_literal[i_literal + this.start_offset];
                    this.data_literal[iplusd_literal + this.length_offset] = this.data_literal[i_literal + this.length_offset];
                }
            }
            else {
                for (var i_abstract = destinationStart_abstract; i_abstract < this.count_abstract; i_abstract++) {
                    let iminusd_abstract = i_abstract - distance_abstract;
                    let iminusd_literal = iminusd_abstract * this.field_count;
                    let i_literal = i_abstract * this.field_count;
                    this.data_literal[i_literal + this.trackedSyntaxKind_offset] = this.data_literal[iminusd_literal + this.trackedSyntaxKind_offset];
                    this.data_literal[i_literal + this.start_offset] = this.data_literal[iminusd_literal + this.start_offset];
                    this.data_literal[i_literal + this.length_offset] = this.data_literal[iminusd_literal + this.length_offset];
                }
            }
        }
        else {
            // TODO: use 'set' method here and other such locations
            for (var i_abstract = 0; i_abstract < length_abstract; i_abstract++) {
                let dSplusi_abstract = destinationStart_abstract + i_abstract;
                let dSplusi_literal = dSplusi_abstract * this.field_count;
                let sSplusi_abstract = sourceStart_abstract + i_abstract;
                let sSplusi_literal = sSplusi_abstract * this.field_count;
                dataDestination_literal[dSplusi_literal + this.trackedSyntaxKind_offset] = dataSource_literal[sSplusi_literal + this.trackedSyntaxKind_offset];
                dataDestination_literal[dSplusi_literal + this.start_offset] = dataSource_literal[sSplusi_literal + this.start_offset];
                dataDestination_literal[dSplusi_literal + this.length_offset] = dataSource_literal[sSplusi_literal + this.length_offset];
            }
        }
    }
}

// /**
//  * Strings and comments are the "only syntax" that entirely clobber how text should be lexed.
//  * 
//  * Thus if I do one full file lex to get the positions of them,
//  * then at any scroll position, I can give the respective lexer
//  * that subset of text that the user sees, and lex it quite accurately if not 100% accurately... I'm not sure.
//  */
// interface TrackedSyntax {
//     constructor (trackedSyntaxKind, start, length) {
//         this.trackedSyntaxKind = trackedSyntaxKind;
//         this.start = start;
//         this.length = length;
//     }
// }
