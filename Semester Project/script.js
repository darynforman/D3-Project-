// This script draws a bar chart using D3:
// - Reads a CSV with monthly rainfall for districts
// - Computes average monthly rainfall per district
// - Draws bars, axes, gridlines, labels, and a tooltip


// Add a tooltip <div> to the page body.
const tooltip = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);

// Margin convention
// width/height below represent the inner drawing area (where bars are drawn).
const margin = { top: 60, right: 30, bottom: 80, left: 80 };
const width = 900 - margin.left - margin.right;
const height = 500 - margin.top - margin.bottom;

// Select the SVG element with id="chart", set size, and append a <g> group
// that is translated by the left/top margins. This keeps axes and content
// aligned and prevents labels from being cut off.
const svg = d3.select("#chart")
    .attr("width", width + margin.left + margin.right) // total SVG width
    .attr("height", height + margin.top + margin.bottom) // total SVG height
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

// Load the CSV data asynchronously. d3.csv returns a Promise.
// Render a chart from a specified CSV file. This wraps the existing drawing
// logic so the chart can be re-rendered when the user switches years.
function renderFromCSV(csvFile) {
    console.log('renderFromCSV: attempting to load', csvFile);
    d3.csv(csvFile).then(data => {
        console.log('Loaded', csvFile, 'rows:', data.length);
        // Remove previously-drawn parts so we can re-render for a new year/file
        svg.selectAll('.grid, .x.axis, .y.axis, .bar, .label, .data-file-label, .error-msg').remove();

    // months array for easy iteration
    
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

    // Convert string values to numbers and handle missing/non-numeric entries.
    // +d[m] coerces to a number; || 0 safeguards empty or invalid strings.
    // This makes sure math operations work correctly.
    data.forEach(d => {
        months.forEach(m => {
            d[m] = +d[m] || 0;
        });
    });

    // Build a new array "yearlyAverages" with objects of shape
    // We use map() to transform each CSV row into the desired object.
    const yearlyAverages = data.map(district => {
        // Sum the 12 months using reduce
        const totalRainfall = months.reduce((sum, month) => sum + district[month], 0);
        return {
            district: district.District, // CSV should have a "District" column
            average: totalRainfall / months.length // monthly average
        };
    // After mapping, sort descending by average so highest bars appear first
    }).sort((a, b) => b.average - a.average);

    // ----------------- Scales -----------------
    // x scale (scaleBand) maps discrete categories (district names)
    // to x positions on the chart area. scaleBand creates evenly-spaced slots.
    // - domain: list of district names
    // - range: pixel range across the inner width (0 to width)
    // - padding: gap between bars
    const x = d3.scaleBand()
        .domain(yearlyAverages.map(d => d.district))
        .range([0, width])
        .padding(0.3);

    // y scale (scaleLinear) maps numeric rainfall values to pixel y positions.
    // - domain: starts at 0 up to the max average * 1.15 (pad above the tallest bar)
    // - range: [height, 0] because SVG y increases downward; flipping makes larger values go higher.
    const y = d3.scaleLinear()
        .domain([0, d3.max(yearlyAverages, d => d.average) * 1.15])
        .range([height, 0]);

    // ----------------- Grid lines -----------------
    // Add faint horizontal grid lines across the chart to help the eye read values.

    svg.append("g")
        .attr("class", "grid")
        .call(d3.axisLeft(y)
            .tickSize(-width)
            .tickFormat("")
            // Using .ticks(8) to control tick count; also safe to use y.ticks(8)
            .ticks(8)
        );

    // ----------------- Color scale -----------------
   
    const colorScale = d3.scaleOrdinal()
        .domain(yearlyAverages.map(d => d.district))
        .range([
            '#a7c7e7', // Soft blue
            '#ffd8b1', // Soft orange
            '#ffb7b2', // Soft red
            '#c1e1c1', // Soft green
            '#fdfd96', // Soft yellow
            '#d4a5d4', // Soft purple
            '#ffb347', // Soft orange-yellow
            '#b5ead7'  // Soft mint
        ]);

    // ----------------- Create bar groups -----------------
    // We create a <g> for each data entry; each group holds the rect and any labels

    const bars = svg.selectAll(".bar")
        .data(yearlyAverages)
        .enter()
        .append("g");

    // ----------------- Append and style rectangles for bars -----------------
    // Each rect's:
    // - x: left position using x(district name)
    // - y: top position using y(average)
    bars.append("rect")
        .attr("class", "bar")
        .attr("x", d => x(d.district))
        .attr("y", d => y(d.average))
        .attr("width", x.bandwidth())
        .attr("height", d => height - y(d.average))
        .attr("rx", 4) // rounded corners
        .attr("ry", 4)
        .attr("fill", d => colorScale(d.district))
        .attr("opacity", 0.9)
        // ----------------- Hover behavior and tooltip -----------------
        // .on("mouseover") highlights the bar and shows the tooltip.
        // .on("mouseout") removes highlight and hides the tooltip.
        // We add an on("mousemove") handler so the tooltip follows the mouse while over a bar.
        .on("mouseover", function(event, d) {
            // Bring the hovered bar to front visually and give it a stroke
            d3.select(this)
                .raise()
                .transition()
                .duration(200)
                .attr("opacity", 1)
                .attr("stroke", "#2c3e50")
                .attr("stroke-width", 2);

            // Show tooltip and set content (district name and average)
            tooltip.transition()
                .duration(200)
                .style("opacity", .9);

            tooltip.html(`
                <div><strong>${d.district}</strong></div>
                <div>${d.average.toFixed(1)} mm</div>
            `)
            // Set initial tooltip position; we update it in mousemove too
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 28) + "px");
        })
        .on("mousemove", function(event /*, d*/) {
            // Keep tooltip aligned to the cursor as it moves over the bar.
            tooltip
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function() {
            // Remove highlight and hide tooltip smoothly
            d3.select(this)
                .transition()
                .duration(200)
                .attr("opacity", 0.9)
                .attr("stroke", "none");

            tooltip.transition()
                .duration(500)
                .style("opacity", 0);
        });

    // ----------------- X axis -----------------
    // X axis uses the x scale; position it at y=height (bottom of the inner chart).
    // The selectAll("text") block styles the tick text (district names).
    svg.append("g")
        .attr("class", "x axis")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .selectAll("text")
            .style("text-anchor", "middle")
            .attr("dy", "1em")
            .style("font-size", "12px")
            .style("fill", "#4a5568");

    // ----------------- Y axis -----------------
    // Y axis uses the y scale; ticks(8) attempts to create ~8 ticks for readability.
    svg.append("g")
        .attr("class", "y axis")
        .call(d3.axisLeft(y).ticks(8));

    // ----------------- Axis labels -----------------
    
    svg.append("text")
        .attr("class", "axis-label")
        .attr("transform", "rotate(-90)")
        .attr("y", -margin.left + 15) // move it left outside the chart area
        .attr("x", -height / 2)       // center along the inner height (after rotation)
        .attr("dy", "1em")
        .style("text-anchor", "middle")
        .style("font-size", "12px")
        .style("fill", "#4a5568")
        .text("Average Monthly Rainfall (mm)");

    // X-axis label: centered under the axis.
    svg.append("text")
        .attr("class", "axis-label")
        .attr("x", width / 2)
        .attr("y", height + margin.bottom - 20)
        .style("text-anchor", "middle")
        .style("font-size", "12px")
        .style("fill", "#4a5568")
        .text("Districts of Belize");

    // ----------------- Chart title -----------------
    // Placed above the chart, centered.
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", -20)
        .attr("text-anchor", "middle")
        .style("font-size", "18px")
        .style("font-weight", "600")
        .style("fill", "#2d3748")
        .text("Average Monthly Rainfall by District in Belize");

    // ----------------- Value labels on top of bars -----------------
    // These text labels show the numeric average above each bar.
    // We calculate x position as the center of the bar using x(d.district) + x.bandwidth()/2.
    svg.selectAll(".label")
        .data(yearlyAverages)
        .enter()
        .append("text")
        .attr("class", "label")
        .attr("x", d => x(d.district) + x.bandwidth() / 2)
        .attr("y", d => y(d.average) - 10) // place slightly above bar top
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .style("font-weight", "500")
        .style("fill", "#4a5568")
        .text(d => d.average.toFixed(1) + "mm");

    }).catch(error => {
    // If loading or parsing the CSV fails, log an error to the console.
    console.error("Failed to load or parse CSV data:", error);
        // Clear chart so user sees no stale data
        svg.selectAll('.grid, .x.axis, .y.axis, .bar, .label').remove();
        // Add a small message in the chart area to indicate failure
        svg.append('text')
            .attr('class', 'error-msg')
            .attr('x', width / 2)
            .attr('y', height / 2)
            .attr('text-anchor', 'middle')
            .style('fill', '#e53e3e')
            .style('font-size', '14px')
            .text('Failed to load ' + csvFile);
    });
}

// Function to download the chart as SVG
function downloadSVG() {
    // Get the SVG element and create a clone to avoid modifying the original
    const svg = document.getElementById('chart');
    const clone = svg.cloneNode(true);
    
    // Add necessary styles directly to the SVG
    const style = document.createElement('style');
    style.textContent = `
        /* Basic SVG styles */
        svg {
            font-family: 'Inter', sans-serif;
        }
        
        /* Bar styles */
        .bar {
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
        }
        
        /* Axis styles */
        .axis path,
        .axis line {
            fill: none;
            stroke: #d1d5db;
            stroke-width: 2px;
            shape-rendering: crispEdges;
        }
        
        .axis text {
            fill: #6b7280;
            font-size: 12px;
            font-weight: 500;
        }
        
        /* Grid lines */
        .grid line {
            stroke: #f1f5f9;
            stroke-opacity: 1;
            shape-rendering: crispEdges;
            stroke-width: 1.5px;
        }
        
        /* Bar labels */
        .bar-label {
            font-size: 12px;
            font-weight: 500;
            fill: #4a5568;
        }
    `;
    
    // Add the style to the SVG
    const defs = document.createElement('defs');
    defs.appendChild(style);
    clone.insertBefore(defs, clone.firstChild);
    
    // Set the viewBox to ensure proper scaling
    clone.setAttribute('viewBox', `0 0 ${svg.width.baseVal.value} ${svg.height.baseVal.value}`);
    
    // Serialize the SVG to a string
    const serializer = new XMLSerializer();
    let svgString = serializer.serializeToString(clone);
    
    // Add XML declaration and SVG namespace
    const svgBlob = new Blob(
        ['<?xml version="1.0" encoding="UTF-8"?>\n' + 
         '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n' +
         svgString], 
        {type: 'image/svg+xml;charset=utf-8'}
    );
    
    // Get the current year from the selected option for the filename
    const yearSelect = document.getElementById('yearSelect');
    const selectedYear = yearSelect.options[yearSelect.selectedIndex].text;
    
    // Create and trigger download
    const url = URL.createObjectURL(svgBlob);
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = `belize-rainfall-${selectedYear}.svg`;
    
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    
    // Clean up
    URL.revokeObjectURL(url);
}

// Function to download the chart as JPG
function downloadJPG() {
    // Get the SVG element (root) on the page
    const svgEl = document.getElementById('chart');
    if (!svgEl) {
        alert('Chart element not found for JPG export.');
        return;
    }

    // Clone the SVG so we can safely modify/inline styles without affecting the displayed chart
    const clone = svgEl.cloneNode(true);

    // Inject minimal CSS into the clone to preserve visual styling in the exported image
    const style = document.createElement('style');
    style.textContent = `
        svg { font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; }
        .bar { transition: none !important; filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.08)); }
        .bar:hover { transform: none !important; }
        .axis path, .axis line { fill: none; stroke: #d1d5db; stroke-width: 2px; shape-rendering: crispEdges; }
        .axis text { fill: #6b7280; font-size: 12px; font-weight: 500; }
        .grid line { stroke: #f1f5f9; stroke-opacity: 1; stroke-width: 1.5px; }
        .label, .axis-label { fill: #4a5568; font-weight: 500; }
        .data-file-label { fill: #4a5568; font-size: 12px; }
    `;
    const defs = document.createElement('defs');
    defs.appendChild(style);
    clone.insertBefore(defs, clone.firstChild);

    // Ensure the clone has a viewBox for scaling; use the original's width/height if present
    const svgWidth = svgEl.width && svgEl.width.baseVal ? svgEl.width.baseVal.value : 900;
    const svgHeight = svgEl.height && svgEl.height.baseVal ? svgEl.height.baseVal.value : 500;
    clone.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);
    clone.setAttribute('width', svgWidth);
    clone.setAttribute('height', svgHeight);

    // Serialize the clone into an SVG string and create a blob URL
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(clone);
    const svgBlob = new Blob([svgString], {type: 'image/svg+xml;charset=utf-8'});
    const url = URL.createObjectURL(svgBlob);

    // Create an image object to load the serialized SVG
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = function() {
        try {
            const canvas = document.createElement('canvas');
            const scale = 2; // higher quality by scaling
            canvas.width = svgWidth * scale;
            canvas.height = svgHeight * scale;
            const ctx = canvas.getContext('2d');

            // Fill with white background
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw the SVG image into the canvas scaled
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            // Convert to JPG and download
            const jpgUrl = canvas.toDataURL('image/jpeg', 0.95);
            const yearSelect = document.getElementById('yearSelect');
            const selectedYear = yearSelect && yearSelect.options ? yearSelect.options[yearSelect.selectedIndex].text : 'chart';
            const downloadLink = document.createElement('a');
            downloadLink.href = jpgUrl;
            downloadLink.download = `belize-rainfall-${selectedYear}.jpg`;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
        } catch (error) {
            console.error('Error generating JPG:', error);
            alert('Error generating JPG. Please try again or use the SVG download option.');
        } finally {
            URL.revokeObjectURL(url);
        }
    };

    img.onerror = function() {
        console.error('Error loading SVG for JPG conversion');
        alert('Error loading the chart for JPG conversion. Please try again.');
        URL.revokeObjectURL(url);
    };

    img.src = url;
}

// Initialize the chart with the default year (2025 - data.csv)
document.addEventListener('DOMContentLoaded', () => {
    // Load the default year data (2025)
    renderFromCSV('data.csv');
    
    // Set up the year selector
    const yearSelect = document.getElementById('yearSelect');
    if (yearSelect) {
        yearSelect.addEventListener('change', (e) => {
            const selectedFile = e.target.value;
            renderFromCSV(selectedFile);
        });
    }
    
    // Set up the download buttons
    const downloadBtn = document.getElementById('downloadBtn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', downloadSVG);
    }
    
    const downloadJpgBtn = document.getElementById('downloadJpgBtn');
    if (downloadJpgBtn) {
        downloadJpgBtn.addEventListener('click', downloadJPG);
    }
});