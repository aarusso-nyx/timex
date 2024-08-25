import * as d3 from 'd3';

import { Vessel, Stay } from '../../models/stay';

type ScaleLinear = d3.ScaleLinear<number, number>;
type ScaleTime = d3.ScaleTime<number, number>;

type Selection = d3.Selection<any, any, any, unknown>;

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
        `ETB: ${fmt(etb)} - ETD: ${fmt(etd)}`,
        `ID: ${d.stay_id}`
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
const selectTwin = (el: Selection): Selection => {
    const [item, id] = el.attr('id').split('-');
    return d3.select(`#${(item === 'ship') ? `stay-${id}` : `ship-${id}`}`);
}


export const retense = (el: Selection, t: Date ) => {
    el.classed('past', (d: Stay) => d.schedule.etd < new Date())
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
    selectTwin(e).classed('selected', e.classed('selected'));
}

export const recheck = (): void => {
    d3.selectAll('g.stay')
        .each(function(this) {
            verify(d3.select(this), selectTwin(d3.select(this)));
        });
}
//////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////
export const draggable = (xScale: ScaleLinear, yScale: ScaleTime) => {
    let dx: number, dy: number;
    let x0: number, y0: number;

    return d3.drag()
        .on('start', function(this: Element, event: any): void {
            d3.select(this).classed('dragging', true);
            [dx, dy] = translationOf(this);

            const twin = selectTwin(d3.select(this));
            if ( !twin.empty() ) {
                [x0, y0] = translationOf(twin.node());
            }
        })
        .on('drag', function(this: Element, event: any): void {
            dx += event.dx;
            dy += event.dy;

            const grab = d3.select(this);
            const twin = selectTwin(grab);
            
            if ( grab.classed('ship') ) {
                grab.attr('transform', `translate(${dx},${0})`);
                twin.attr('transform', `translate(${dx},${y0})`);
                verify(twin, grab);
            } else {
                grab.attr('transform', `translate(${dx},${dy})`);
                twin.attr('transform', `translate(${dx},${0})`);
                verify(grab, twin);
            }
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
            dad = parent(dot).classed('stretching', true);
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

            verify(dad, selectTwin(dad));
        })
        .on('end', function(this: Element): void {
            dad.classed('stretching', false);
            update(dad, xScale, yScale);
        });
} 

//////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////
const verify = (elem: Selection, twin: Selection): void => {
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
    
    let overlap = false;
    d3.selectAll('g.stay')
        .filter(function(this) {
            return this !== elem.node();
        })
        .each(function(this) {
            const o = overlaps(this, elem.node());
            overlap ||= o;
        });

    twin.classed('overlap', overlap);
    elem.classed('overlap', overlap)
        .selectAll('text')
        .data(labelOf(elem.datum()).split('\n'))
        .text((d: string) => d);
}

//////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////
const update = (elem: Selection, xScale: ScaleLinear, yScale: ScaleTime): void => {
    const twin = selectTwin(elem);
    const d = elem.datum();

    let [x, y] = translationOf(elem.node());

    const gStay = 6*3600000;         // 6 hours 
    const gPier = 50;               // 10 meters
    
    let p = snap(d.docking.pos, gPier);
    let p1 = snap(xScale.invert(x), gPier);

    // Update the docking position
    let touched = (p !== p1); 

    d.docking.pos = (p !== p1) ? p1 : p;
    
    if ( elem.classed('stay') ) {
        let h = +elem.select('rect').attr('height');
        
        const etd = snap(d.schedule.etd.getTime(), gStay);
        const etb = snap(d.schedule.etb.getTime(), gStay);
        
        const netd = snap(yScale.invert(y).getTime(), gStay);
        const netb = snap(yScale.invert(y+h).getTime(), gStay);

        d.schedule.etd = (etd !== netd) ? new Date(netd) : new Date(etd);
        d.schedule.etb = (etb !== netb) ? new Date(netb) : new Date(etb);

        touched ||= (etd !== netd) || (etb !== netb);
        
        x = xScale(d.docking.pos);
        y = yScale(d.schedule.etd);
        h = yScale(d.schedule.etb) - y;
        
        twin.attr('transform', `translate(${x},0)`);
        elem.attr('transform', `translate(${x},${y})`)
            .select('rect')
            .attr('height', h);
    } else {
        let [xt, yt] = translationOf(twin.node());
        elem.attr('transform', `translate(${x},0)`);
        twin.attr('transform', `translate(${x},${yt})`);
    }
    
    // Updating the data and marking the element as touched
    if ( touched ) {
        elem.datum(d).classed('touched', true);
        twin.datum(d).classed('touched', true);
    }
    
    // Updating the visual representation
    const t = +d3.select('line.timeline').attr('y1');
    retense(elem, new Date(yScale.invert(t)));
}