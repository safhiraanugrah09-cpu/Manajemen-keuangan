const STORAGE_KEY = "finansialku_transactions_v1";
const categories = {
  income: ["Gaji", "Bonus", "Bisnis", "Investasi", "Hadiah", "Lainnya"],
  expense: ["Makanan", "Transportasi", "Belanja", "Tagihan", "Hiburan", "Kesehatan", "Pendidikan", "Lainnya"]
};
const palette = ["#1b9b72","#6e91d7","#f0b65c","#d77b9c","#8e7acb","#59b7c1","#e18a5b","#9ba6b7"];
let transactions = loadTransactions();
let flowChart, categoryChart;

function loadTransactions() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}
function saveTransactions() { localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions)); }
function rupiah(value) {
  return new Intl.NumberFormat("id-ID", {style:"currency", currency:"IDR", maximumFractionDigits:0}).format(value || 0);
}
function formatDate(value) {
  if (!value) return "-";
  return new Date(value + "T00:00:00").toLocaleDateString("id-ID", {day:"2-digit", month:"short", year:"numeric"});
}
function totals() {
  const income = transactions.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0);
  const expense = transactions.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0);
  return {income, expense, balance:income-expense};
}
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function updateSummary() {
  const t=totals();
  document.getElementById("balanceValue").textContent=rupiah(t.balance);
  document.getElementById("incomeValue").textContent=rupiah(t.income);
  document.getElementById("expenseValue").textContent=rupiah(t.expense);
  document.getElementById("reportIncome").textContent=rupiah(t.income);
  document.getElementById("reportExpense").textContent=rupiah(t.expense);
  document.getElementById("reportDifference").textContent=rupiah(t.balance);
}
function transactionHTML(t, withAction=false) {
  const isIncome=t.type==="income";
  return `<tr>
    <td><span class="transaction-name">${escapeHTML(t.name)}</span><span class="transaction-sub">${escapeHTML(t.note||"Transaksi pribadi")}</span></td>
    <td>${escapeHTML(t.category)}</td><td>${formatDate(t.date)}</td>
    ${withAction?`<td><span class="type-pill ${t.type}">${isIncome?"Pemasukan":"Pengeluaran"}</span></td>`:""}
    <td class="${isIncome?"amount-income":"amount-expense"}">${isIncome?"+":"−"} ${rupiah(t.amount)}</td>
    ${withAction?`<td><button class="delete-btn" data-delete="${t.id}">Hapus</button></td>`:""}
  </tr>`;
}
function renderTables() {
  const sorted=[...transactions].sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt);
  document.getElementById("recentRows").innerHTML=sorted.slice(0,5).map(t=>transactionHTML(t)).join("") || `<tr><td colspan="4" class="muted">Belum ada transaksi.</td></tr>`;
  const query=document.getElementById("searchInput").value.toLowerCase();
  const type=document.getElementById("typeFilter").value;
  const category=document.getElementById("categoryFilter").value;
  const filtered=sorted.filter(t=>(t.name.toLowerCase().includes(query)||t.category.toLowerCase().includes(query))&&(type==="all"||t.type===type)&&(category==="all"||t.category===category));
  document.getElementById("transactionRows").innerHTML=filtered.map(t=>transactionHTML(t,true)).join("");
  document.getElementById("emptyState").hidden=filtered.length>0;
  document.getElementById("transactionRows").querySelectorAll("[data-delete]").forEach(btn=>btn.addEventListener("click",()=>deleteTransaction(btn.dataset.delete)));
}
function populateCategories() {
  const type=document.getElementById("formType").value;
  document.getElementById("formCategory").innerHTML=categories[type].map(c=>`<option>${c}</option>`).join("");
  const all=[...new Set([...categories.income,...categories.expense])];
  document.getElementById("categoryFilter").innerHTML='<option value="all">Semua kategori</option>'+all.map(c=>`<option>${c}</option>`).join("");
}
function renderCharts() {
  if (!window.Chart) return;
  const monthly={};
  transactions.forEach(t=>{
    const d=new Date(t.date+"T00:00:00");
    const key=d.toLocaleDateString("id-ID",{month:"short",year:"2-digit"});
    if(!monthly[key]) monthly[key]={income:0,expense:0,sort:d.getFullYear()*12+d.getMonth()};
    monthly[key][t.type]+=t.amount;
  });
  const months=Object.entries(monthly).sort((a,b)=>a[1].sort-b[1].sort).slice(-6);
  const flowData=months.length?months:[["Belum ada", {income:0,expense:0}]];
  if(flowChart) flowChart.destroy();
  flowChart=new Chart(document.getElementById("flowChart"),{type:"bar",data:{labels:flowData.map(x=>x[0]),datasets:[{label:"Pemasukan",data:flowData.map(x=>x[1].income),backgroundColor:"#1b9b72",borderRadius:5},{label:"Pengeluaran",data:flowData.map(x=>x[1].expense),backgroundColor:"#f0b65c",borderRadius:5}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:"bottom",labels:{usePointStyle:true,boxWidth:7,font:{size:10}}}},scales:{x:{grid:{display:false},ticks:{font:{size:10}}},y:{beginAtZero:true,grid:{color:"#f0f2f5"},ticks:{font:{size:9},callback:v=>new Intl.NumberFormat("id-ID",{notation:"compact"}).format(v)}}}}});
  const expenses=transactions.filter(t=>t.type==="expense");
  const sums={}; expenses.forEach(t=>sums[t.category]=(sums[t.category]||0)+t.amount);
  const labels=Object.keys(sums), values=Object.values(sums);
  if(categoryChart) categoryChart.destroy();
  categoryChart=new Chart(document.getElementById("categoryChart"),{type:"doughnut",data:{labels:labels.length?labels:["Belum ada data"],datasets:[{data:values.length?values:[1],backgroundColor:labels.length?labels.map((_,i)=>palette[i%palette.length]):["#edf0f5"],borderWidth:0,hoverOffset:5}]},options:{responsive:true,maintainAspectRatio:false,cutout:"70%",plugins:{legend:{display:false}}}});
  document.getElementById("categoryLegend").innerHTML=labels.map((l,i)=>`<span class="legend-item"><i class="legend-dot" style="background:${palette[i%palette.length]}"></i>${escapeHTML(l)}</span>`).join("") || '<span class="muted" style="font-size:10px">Belum ada data pengeluaran</span>';
  const total=values.reduce((a,b)=>a+b,0);
  document.getElementById("reportCategories").innerHTML=labels.length?labels.map((l,i)=>`<div><div class="report-category-head"><span>${escapeHTML(l)}</span><strong>${rupiah(sums[l])} · ${Math.round(sums[l]/total*100)}%</strong></div><div class="progress-track"><div class="progress-fill" style="width:${sums[l]/total*100}%"></div></div></div>`).join(""):'<p class="muted">Belum ada data pengeluaran untuk ditampilkan.</p>';
}
function refresh() { updateSummary(); renderTables(); renderCharts(); }
function openModal() {
  const form=document.getElementById("transactionForm");
  form.reset(); form.elements.date.value=new Date().toISOString().slice(0,10); populateCategories();
  document.getElementById("transactionModal").classList.add("show");
}
function closeModal() { document.getElementById("transactionModal").classList.remove("show"); }
function deleteTransaction(id) {
  if(!confirm("Yakin ingin menghapus transaksi ini?")) return;
  transactions=transactions.filter(t=>String(t.id)!==String(id)); saveTransactions(); refresh();
}
function navigate(page) {
  document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.id===page));
  document.querySelectorAll(".nav-link").forEach(a=>a.classList.toggle("active",a.dataset.page===page));
  document.getElementById("pageTitle").textContent=({dashboard:"Dashboard",transaksi:"Transaksi",laporan:"Laporan"})[page]||"Dashboard";
  document.getElementById("sidebar").classList.remove("open");
}
document.querySelectorAll(".nav-link").forEach(a=>a.addEventListener("click",e=>{e.preventDefault();navigate(a.dataset.page)}));
document.querySelectorAll("[data-goto]").forEach(a=>a.addEventListener("click",()=>navigate(a.dataset.goto)));
document.getElementById("menuToggle").addEventListener("click",()=>document.getElementById("sidebar").classList.toggle("open"));
document.getElementById("quickAdd").addEventListener("click",openModal);
document.getElementById("addTransaction").addEventListener("click",openModal);
document.getElementById("closeModal").addEventListener("click",closeModal);
document.getElementById("transactionModal").addEventListener("click",e=>{if(e.target.id==="transactionModal")closeModal()});
document.getElementById("formType").addEventListener("change",populateCategories);
document.getElementById("transactionForm").addEventListener("submit",e=>{
  e.preventDefault(); const data=new FormData(e.target);
  transactions.push({id:Date.now(),name:data.get("name").trim(),type:data.get("type"),category:data.get("category"),amount:Number(data.get("amount")),date:data.get("date"),note:data.get("note").trim(),createdAt:Date.now()});
  saveTransactions(); refresh(); closeModal(); navigate("transaksi");
});
["searchInput","typeFilter","categoryFilter"].forEach(id=>document.getElementById(id).addEventListener(id==="searchInput"?"input":"change",renderTables));
document.getElementById("exportCsv").addEventListener("click",()=>{
  if(!transactions.length){alert("Belum ada transaksi untuk diekspor.");return;}
  const rows=[["Nama","Jenis","Kategori","Tanggal","Jumlah","Catatan"],...transactions.map(t=>[t.name,t.type==="income"?"Pemasukan":"Pengeluaran",t.category,t.date,t.amount,t.note||""])];
  const csv=rows.map(row=>row.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"}),url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download="laporan-keuangan.csv";a.click();URL.revokeObjectURL(url);
});
document.getElementById("dateChip").textContent=new Date().toLocaleDateString("id-ID",{weekday:"short",day:"numeric",month:"short",year:"numeric"});
document.getElementById("todayLabel").textContent=new Date().toLocaleDateString("id-ID",{weekday:"long",day:"numeric",month:"long",year:"numeric"}).toUpperCase();
populateCategories(); refresh();
