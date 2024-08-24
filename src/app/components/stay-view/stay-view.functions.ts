import * as d3 from 'd3';

import { Vessel, Stay } from '../../models/stay';

type ScaleLinear = d3.ScaleLinear<number, number>;
type ScaleTime = d3.ScaleTime<number, number>;
type Selection = d3.Selection<SVGGElement, Stay, SVGSVGElement, unknown>;

//////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////
export const snap = (n: number, m: number): number => Math.round(n/m)*m;

//////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////
export const translationOf = (el: Element): [number, number] => {
    const d = d3.select(el)
                .attr('transform')
                .match(/translate\(([^)]+)\)/);
  
    return d ? (d[1].split(',').map(Number) as [number, number]) : [0, 0];
}

//////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////
export const labelOf = (d: Stay): string => {
    const pos = d.docking.pos;
    const { etb, etd } = d.schedule;
    const fmt = (d: Date) => d3.timeFormat('%H:%M %d/%m')(d);
    const labels = [
        `${d.vessel.vessel_name} (${d.vessel.lpp}m) @ ${Math.round(pos)}m`,
        `ETB: ${fmt(etb)} - ETD: ${fmt(etd)}`
    ];

    return labels.join('\n');
}

//////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////
export const makeHull = (v: Vessel, d: number=1): string => {
    const l = 2*v.lpp;
    const b = 2*v.beam;
  
    return (d === 1)? `M 0,0 V ${b} H ${0.8*l} L ${0.95*l},${b/2} L ${0.8*l},0 Z`
                    : `M ${0.95*l},0 V ${b} H ${0.2*l} L 0,${b/2} L ${0.2*l},0 Z`;
}

//////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////
export const retense = (el: Selection, t: Date ) => {
    el.classed('past', (d: Stay) => d.schedule.etd < t)
        .classed('future', (d: Stay) => d.schedule.etb > t)
        .classed('current', (d: Stay) => d.schedule.etb <= t && t <= d.schedule.etd)
        .classed('selected', false);
}

export const deleted = (el: Selection ) => {
    el.selectAll('.selected')  
        .classed('selected', false)
        .classed('touched', true)
        .classed('deleted', true); 
}

export const clickable = (event: PointerEvent) => { 
    const elem = event.target as Element;
    const e = d3.select(elem.parentElement);
    e.classed('selected', !e.classed('selected'));

    const [item, id] = e.attr('id').split('-');
    const twin = d3.select(`#${(item === 'ship') ? `stay-${id}` : `ship-${id}`}`);
    twin.classed('selected', e.classed('selected'));
}


//////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////
export const draggable = (xScale: ScaleLinear, yScale: ScaleTime) => {
    let dx: number, dy: number;

    return d3.drag()
        .on('start', function(this: Element, event: any): void {
            d3.select(this).classed('dragging', true);
            [dx, dy] = translationOf(this);
        })
        .on('drag', function(this: Element, event: any): void {
            dx += event.dx;
            dy += event.dy;

            const grab = d3.select(this);

            if ( grab.classed('ship') ) {
                grab.attr('transform', `translate(${dx},${0})`);
            } else {
                grab.attr('transform', `translate(${dx},${dy})`);
            }
            
            verify(mirror(grab, dx));  
        })
        .on('end', function(this: Element): void {
            d3.select(this).classed('dragging', false);
            update(d3.select(this), xScale, yScale);
        });
}

//////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////
export const stretchable = (xScale: ScaleLinear, yScale: ScaleTime) => {
    let dot: any, dad: any, box: any;
    
    let h0: number;
    let x0: number, y0: number;
    let xt: number, yt: number;

    const parent = (el: any): any => d3.select(el.node().parentNode);
    const boxOf = (el: any): any => parent(el).select('rect');

    return d3.drag()
        .on('start', function(this: Element, event: any): void {
            dot = d3.select(this);
            dad = parent(dot).classed('dragging', true);
            box = boxOf(dot);
            
            [xt, yt] = translationOf(dad.node());
            [x0, y0] = d3.pointer(event, this.parentNode?.parentNode);

            h0 = +box.attr('height');
        })
        .on('drag', function(this: Element, event: any): void {
            const [x, y] = d3.pointer(event, this.parentNode?.parentNode);
          
            if (h0-(y-y0) < 0) return;

            dad.attr('transform', `translate(${xt},${yt+(y-y0)})`);
            box.attr('height', Math.max(h0-(y-y0), 0));

            verify(dad);
        })
        .on('end', function(this: Element): void {
            dad.classed('dragging', false);
            update(dad, xScale, yScale);
        });
} 


//////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////
const mirror = (el: any, x: number ): any => {
    el.classed('touched', true);

    const [ item, id ] = el.attr('id').split('-');
    const _id = (item === 'ship') ? `stay-${id}` : `ship-${id}`;
    const twin = d3.select(`#${_id}`);
    
    if ( twin.empty() ) return;

    const tr = translationOf(twin.node() as Element);
    twin.attr('transform', `translate(${x},${tr[1]})`)
        .classed('touched', true);

    return (item === 'ship') ? twin : el;
}

//////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////
const verify = (elem: Selection): void => {
    if ( !elem ) return;

    const overlaps = (a: any, b: any): boolean => {
        const [ax, ay] = translationOf(a);
        const [bx, by] = translationOf(b);
        
        const aw = +d3.select(a).select('rect').attr('width');
        const ah = +d3.select(a).select('rect').attr('height');
        const bw = +d3.select(b).select('rect').attr('width');
        const bh = +d3.select(b).select('rect').attr('height');
        
        return (ax < bx + bw && ax + aw > bx &&
                ay < by + bh && ay + ah > by);
    }
    
    const id = elem.attr('id').split('-')[1];
    const twin = d3.select(`#ship-${id}`);
    
    let overlap = false;
    d3.selectAll('g.stay')
        .filter(function(this) {
            return this !== elem.node();
        })
        .each(function(this) {
            const o = overlaps(this, elem.node());
            overlap ||= o;

            d3.select(this).classed('overlap', o);
        });


    elem.classed('overlap overlapping', overlap)
        .classed('touched', true)
        .selectAll('text')
        .data(labelOf(elem.datum()).split('\n'))
        .text((d: string) => d);

    twin.classed('overlap overlapped', overlap)
        .classed('touched', true);
}


//////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////
const update = (elem: any, xScale: ScaleLinear, yScale: ScaleTime): void => {
    const d = elem.datum() as Stay;
    const [x, y] = translationOf(elem.node());
    
    // Updating Datum
    if ( elem.classed('stay') ) {
        const h = +elem.select('rect').attr('height');
        d.schedule.etd = new Date(yScale.invert(y));
        d.schedule.etb = new Date(yScale.invert(y+h));
    }

    d.docking.pos  = xScale.invert(x);
    elem.datum(d);
    
    // Updating the visual representation
    const yt = +d3.select('line.cursor').attr('y1');
    retense(elem, new Date(yScale.invert(yt)));
} 

