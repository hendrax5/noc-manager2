"use client";
import BodPanel from '@/components/BodPanel';
import {statusStyle} from '@/lib/tickets/status';
import WorkPhasePanel from "@/components/tickets/WorkPhasePanel";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import AsyncSearchSelect from "@/components/AsyncSearchSelect";
import TicketWorkClassification, { TicketServicePicker } from "@/components/TicketWorkClassification";
import { getServiceCid } from "@/lib/services/cid";
import { WORK_TYPE_LABELS } from "@/lib/tickets/workClassification";
import ServiceWorkSummary from "@/components/ServiceWorkSummary";
import { serviceWorkInput, serviceWorkResolveMessage } from "@/lib/tickets/serviceWorkView";
import SearchableSelect from "@/components/SearchableSelect";
import {
  getDowntimeDuration as calcDowntimeDuration,
  toDatetimeLocalValue,
  nowDatetimeLocal,
  effectiveDowntimeMinutes,
} from "@/lib/tickets/downtime";
import { formatCustomValue, displayableCustomEntries } from "@/lib/ui/customDataView";


function linkify(text) {
  if (!text) return "";
  if (text.includes("<a ")) {
    return text.replace(/<a\b([^>]*)>/gi, (match, attrs) => {
      if (!attrs.includes("target=")) {
        return `<a target="_blank" rel="noopener noreferrer" ${attrs}>`;
      }
      return match;
    });
  }
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.replace(urlRegex, function(url) {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color: #3b82f6; text-decoration: underline; word-break: break-all;">${url}</a>`;
  });
}

function htmlToPlainText(html) {
  if (!html) return "";
  let text = html.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/p>/gi, "\n");
  text = text.replace(/<p\b[^>]*>/gi, "");
  text = text.replace(/&nbsp;/gi, " ");
  text = text.replace(/&amp;/gi, "&");
  text = text.replace(/&lt;/gi, "<");
  text = text.replace(/&gt;/gi, ">");
  text = text.replace(/&quot;/gi, '"');
  text = text.replace(/<\/?[^>]+(>|$)/g, "");
  return text;
}

export default function TicketDetailClient({ ticket, departments, users, jobCategories, customFields, canModifyTicket, currentUser, serviceTemplates, services = [] }) {
  const router = useRouter();
  
  const currentUserObj = currentUser || {};
  const currentUserId = currentUserObj.id ? parseInt(currentUserObj.id) : null;

  const isCreator = ticket.historyLogs && ticket.historyLogs.length > 0 && ticket.historyLogs[ticket.historyLogs.length - 1].actorId === currentUserId;
  
  const isCS = currentUserObj.department?.includes('CS') || currentUserObj.department?.toLowerCase().includes('customer');
  const isAdminOrManager = currentUserObj.role === 'Admin' || currentUserObj.role === 'Manager';
  const isAuthorized = currentUserObj.role === 'Admin' || currentUserObj.role === 'Manager' || isCS || currentUserObj.permissions?.includes('manage_tickets');

  const canChangeStatus = isAuthorized || currentUserObj.permissions?.includes('change_ticket_status') || currentUserObj.permissions?.includes('modify_tickets');
  const canAssign = isAuthorized || currentUserObj.permissions?.includes('assign_tickets') || currentUserObj.permissions?.includes('modify_tickets');
  const canChangeJobCategory = isAuthorized || currentUserObj.permissions?.includes('change_job_category') || currentUserObj.permissions?.includes('modify_tickets');
  const canDelete = isAuthorized || currentUserObj.permissions?.includes('delete_tickets');

  const hasEditOwn = currentUserObj.permissions?.includes('edit_own_tickets');
  const hasEditOther = currentUserObj.permissions?.includes('edit_other_tickets');
  const showTicketEdit = isAuthorized || 
                         currentUserObj.permissions?.includes('modify_tickets') ||
                         (isCreator && hasEditOwn) ||
                         (!isCreator && hasEditOther);

  const canManageSla = isAuthorized || currentUserObj.permissions?.includes('manage_sla') || currentUserObj.permissions?.includes('manage_tickets');
  const canViewNotes = isAuthorized || currentUserObj.permissions?.includes('view_internal_notes') || currentUserObj.permissions?.includes('manage_tickets');
  const canWriteNotes = isAuthorized || currentUserObj.permissions?.includes('manage_ticket_notes') || currentUserObj.permissions?.includes('manage_tickets');

  const [editingTicket, setEditingTicket] = useState(false);
  const [editTitle, setEditTitle] = useState(ticket.title);
  const [editDesc, setEditDesc] = useState(htmlToPlainText(ticket.description));
  
  const textareaRef = useRef(null);
  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  };

  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const [visibleCustomFieldIds, setVisibleCustomFieldIds] = useState([]);
  const [replyCustomData, setReplyCustomData] = useState({});

  const [replyEnableSla, setReplyEnableSla] = useState(ticket?.enableSla || false);
  const [replySlaMins, setReplySlaMins] = useState(ticket?.slaTimerMins || 15);

  const [formData, setFormData] = useState({
    workType: ticket.workType || "Unclassified",
      serviceWorkTypeId: ticket.serviceWorkTypeId || null,
      serviceChange: serviceWorkInput(ticket.serviceChange),
      sapReference: ticket.sapReference || "",
      symptomId: ticket.symptomId || null,
      causeId: ticket.causeId || null,
      symptomLabel: ticket.symptomLabel || null,
      causeLabel: ticket.causeLabel || null,
      serviceIds: (ticket.services || []).map(service => service.id),
      title: ticket.title,
    description: ticket.description,
    status: ticket.status,
    priority: ticket.priority,
    ticketType: ticket.ticketType || "Incident",
    approvalStatus: ticket.approvalStatus || "",
    departmentId: ticket.departmentId,
    assigneeId: ticket.assigneeId || "",
    jobCategoryId: ticket.jobCategoryId || "",
    customData: ticket.customData || {},
    enableSla: ticket.enableSla || false,
    slaTimerMins: ticket.slaTimerMins || 15
  });
  const [commentText, setCommentText] = useState(currentUser.signature ? `\n\n${currentUser.signature}` : "");
  const [isPublicReply, setIsPublicReply] = useState(true);
  const [watching, setWatching] = useState(
    Array.isArray(ticket.watchers) && ticket.watchers.some((w) => w.userId === currentUserId || w.user?.id === currentUserId)
  );
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentError, setCommentError] = useState("");
  const [submitAction, setSubmitAction] = useState('reply');
  const [showSubmitDropdown, setShowSubmitDropdown] = useState(false);
  const [slaLoading, setSlaLoading] = useState(false);
  
  const [mounted, setMounted] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const [customerSearchTerm, setCustomerSearchTerm] = useState(formData.customData?.["Customer Name"] || '');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const customerWrapperRef = useRef(null);

  const matchingCustomerServices = (services || []).filter(s => {
    const term = customerSearchTerm.toLowerCase();
    if (!term) return false;
    const custName = s.customer?.name?.toLowerCase() || "";
    const srvName = s.name?.toLowerCase() || "";
    const srvId = String(getServiceCid(s) || "").toLowerCase();
    return custName.includes(term) || srvName.includes(term) || srvId.includes(term);
  });

  const handleSelectCustomerService = (s) => {
    setCustomerSearchTerm(s.customer?.name || "");
    setFormData({
      ...formData,
      customData: {
        ...(formData.customData || {}),
        "Customer Name": s.customer?.name || ""
      }
    });
    setIsCustomerDropdownOpen(false);
  };

  const getDowntimeDuration = (startDt, endDt, live = false) => {
    if (!startDt) return null;
    return calcDowntimeDuration(startDt, endDt || null, { live: live || !endDt });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleString('id-ID', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  // Activity Notes State (Phase 34)
  const [notes, setNotes] = useState([]);
  const [noteContent, setNoteContent] = useState("");
  const [noteType, setNoteType] = useState("internal");
  const [noteLoading, setNoteLoading] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(true);

  const [now, setNow] = useState(new Date().getTime());
  useEffect(() => {
    setMounted(true);
    // Fetch notes
    fetch(`/api/tickets/${ticket.id}/notes`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setNotes(data))
      .catch(() => {});

    // Sync state values with newly loaded server-side props
    setEditTitle(ticket.title);
    setEditDesc(htmlToPlainText(ticket.description));
    setFormData({
      workType: ticket.workType || "Unclassified",
      serviceWorkTypeId: ticket.serviceWorkTypeId || null,
      serviceChange: serviceWorkInput(ticket.serviceChange),
      sapReference: ticket.sapReference || "",
      symptomId: ticket.symptomId || null,
      causeId: ticket.causeId || null,
      symptomLabel: ticket.symptomLabel || null,
      causeLabel: ticket.causeLabel || null,
      serviceIds: (ticket.services || []).map(service => service.id),
      title: ticket.title,
      description: ticket.description,
      status: ticket.status,
      priority: ticket.priority,
      departmentId: ticket.departmentId,
      assigneeId: ticket.assigneeId || "",
      jobCategoryId: ticket.jobCategoryId || "",
      ticketType: ticket.ticketType || "Incident",
      approvalStatus: ticket.approvalStatus || "",
      customData: ticket.customData || {},
      enableSla: ticket.enableSla || false,
      slaTimerMins: ticket.slaTimerMins || 15
    });
    setCustomerSearchTerm(ticket.customData?.["Customer Name"] || '');

    function handleClickOutside(event) {
      if (customerWrapperRef.current && !customerWrapperRef.current.contains(event.target)) {
        setIsCustomerDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);

    let interval;
    if (
      ticket.enableSla &&
      ticket.status !== "Resolved" &&
      ticket.status !== "Closed" &&
      ticket.status !== "Pending" &&
      ticket.status !== "Waiting Reply"
    ) {
      interval = setInterval(() => setNow(Date.now()), 10000);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      if (interval) clearInterval(interval);
    };
  }, [ticket]);

  useEffect(() => {
    if (editingTicket) {
      const timer = setTimeout(adjustTextareaHeight, 50);
      return () => clearTimeout(timer);
    }
  }, [editingTicket, editDesc]);

  const triggerAutoSave = async (key, newValue) => {
    if ((key === 'status' || key === 'priority') && !canChangeStatus) return;
    if ((key === 'departmentId' || key === 'assigneeId') && !canAssign) return;
    if (key === 'jobCategoryId' && !canChangeJobCategory) return;
    const hasOwnGate = key === 'status' || key === 'priority' || key === 'departmentId' || key === 'assigneeId' || key === 'jobCategoryId';
    if (!hasOwnGate && !canModifyTicket) return;
    if (key === "status" && newValue === "Resolved") {
      const catId = formData.jobCategoryId || ticket.jobCategoryId;
      if (!catId) {
        toast.error("Pilih Job Phase Category dulu sebelum resolve, supaya poin teknisi (orang last reply) ikut masuk.");
        return;
      }
      const summary = serviceWorkResolveMessage(ticket);
      if (summary && !window.confirm(summary)) return;
    }
    const previousValue = formData[key];
    setFormData(prev => ({ ...prev, [key]: newValue }));
    const numericKeys = ['departmentId', 'assigneeId', 'jobCategoryId'];
    const updatedPayload = { [key]: numericKeys.includes(key) ? (newValue ? Number(newValue) : null) : newValue };
    // Status updates must not resubmit stale edit fields or server-owned snapshots.
    if (key === 'status' && newValue === 'Resolved' && !ticket.jobCategoryId && formData.jobCategoryId) updatedPayload.jobCategoryId = Number(formData.jobCategoryId);

    const res = await fetch(`/api/tickets/${ticket.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedPayload)
    });
    
    if (res.ok) {
      router.refresh(); 
    } else {
      setFormData(prev => ({ ...prev, [key]: previousValue }));
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Failed to auto-update ticket property.");
    }
  };

  const saveTicketEdit = async () => {
    const classificationChanged = formData.workType !== (ticket.workType || "Unclassified") || formData.symptomId !== (ticket.symptomId || null) || formData.causeId !== (ticket.causeId || null) || JSON.stringify(formData.serviceIds) !== JSON.stringify((ticket.services || []).map(service => service.id));
    if (formData.workType === "Trouble" && classificationChanged && (!formData.symptomId || !formData.causeId || !formData.serviceIds.length || formData.serviceIds.some(id => !getServiceCid(services.find(service => service.id === id))))) {
      toast.error("Trouble memerlukan gejala, penyebab, dan minimal satu layanan. Semua layanan terpilih wajib memiliki CID.");
      return;
    }
    setLoading(true);
    const editableData = { ...formData };
    const unchangedServiceWork = Number(formData.serviceWorkTypeId) === Number(ticket.serviceWorkTypeId) &&
      JSON.stringify(formData.serviceChange) === JSON.stringify(serviceWorkInput(ticket.serviceChange));
    if (ticket.serviceChange?.appliedAt || unchangedServiceWork) {
      delete editableData.serviceChange;
      delete editableData.serviceWorkTypeId;
    }
    if (ticket.serviceChange?.appliedAt) {
      delete editableData.workType;
      delete editableData.serviceIds;
    }
    const res = await fetch(`/api/tickets/${ticket.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        ...editableData,
        title: editTitle, 
        description: editDesc, 
        customData: formData.customData,
        enableSla: formData.enableSla,
        slaTimerMins: formData.slaTimerMins
      })
    });
    if(res.ok) {
      setEditingTicket(false);
      toast.success("Ticket saved");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Failed to save changes");
    }
    setLoading(false);
  };

  const saveCommentEdit = async (id) => {
    const res = await fetch(`/api/tickets/${ticket.id}/comments/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: editingCommentText })
    });
    if(res.ok) {
      setEditingCommentId(null);
      router.refresh();
    } else toast.error("Failed to save comment edits");
  };

  const handleDelete = async () => {
    if(confirm("DANGER: Are you sure you want to permanently delete this ticket and all tracking logs?")) {
      const res = await fetch(`/api/tickets/${ticket.id}`, { method: "DELETE" });
      if (res.ok) {
        window.location.href = "/tickets";
      } else {
        const data = await res.json();
        toast.error("Failed to delete ticket: " + (data.error || "Unknown error"));
      }
    }
  };

  const handleCommentSubmit = async (e, actionType = 'reply') => {
    e.preventDefault();
    if (!commentText.trim() && !file) return;
    setCommentLoading(true);
    setCommentError("");
    
    let attachmentUrl = null;
    let attachmentName = null;

    if (file) {
      const fd = new FormData();
      fd.append("file", file);
      const rep = await fetch("/api/upload", { method: "POST", body: fd });
      if (rep.ok) {
        const json = await rep.json();
        attachmentUrl = json.url;
        attachmentName = json.filename;
      }
    }

    const res = await fetch(`/api/tickets/${ticket.id}/comments`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: commentText, attachmentUrl, attachmentName, actionType, replyCustomData, replyEnableSla, replySlaMins, isPublic: isPublicReply })
    });
    if (res.ok) {
      const updatedStatus = actionType === 'finish' ? 'Finish' : 'Auto';
      setCommentText(currentUser.signature ? `\n\n${currentUser.signature}` : "");
      setFile(null);
      setReplyCustomData({});
      setVisibleCustomFieldIds([]);
      setFormData({...formData, status: updatedStatus, customData: { ...(formData.customData || {}), ...replyCustomData }});
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setCommentError(body.error || "Balasan gagal dikirim. Coba lagi tanpa kehilangan teks.");
    }
    setCommentLoading(false);
  };

  const optionalFields = customFields?.filter(f => !visibleCustomFieldIds.includes(f.id)) || [];

  return (
    <div className="ui-static-0410aac9fd" style={{display: 'grid', gridTemplateColumns: 'minmax(0, 7fr) minmax(300px, 3fr)', alignItems: 'flex-start'}}>

      <div className="ui-static-92254f43e7" style={{display: 'flex', flexDirection: 'column'}}>
        
        <div className="ui-static-4fe18a48ed" >
          {editingTicket ? (
            <div className="ui-static-8bd9dc7312" >
              <label className="ui-static-b2e12522e5" style={{display: 'block'}}>Subjek / Judul Tiket:</label>
              <input 
                value={editTitle} 
                onChange={e => setEditTitle(e.target.value)} 
                placeholder="Masukkan subjek/judul tiket..."
                className="ui-static-dd68ef4f72" style={{width: '100%'}}
              />
            </div>
          ) : (
            <div className="ui-static-3e8220669e" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
              <h1 className="ui-static-9818f2ec7b" >
                {ticket.title}
                {ticket.customData && Object.values(ticket.customData).some(val => typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val) && new Date(val) < new Date()) && ticket.status !== 'Resolved' && (
                  <span className="badge ui-static-cb3bfb3d32" style={{verticalAlign: 'middle'}}> EXPIRED</span>
                )}
              </h1>
              {ticket.enableSla && (
                <div className="ui-static-a7fa7be848" >
                  {(() => {
                    if (ticket.status === 'Resolved' || ticket.status === 'Waiting Reply') {
                      return <span className="badge ui-static-48c0214ff2" > SLA Paused</span>;
                    }
                    if (!ticket.nextSlaDeadline) return null;
                    const diffMins = Math.round((new Date(ticket.nextSlaDeadline).getTime() - now) / 60000);
                    if (diffMins < 0) {
                      return <span className="badge ui-static-157bcc3a57" > OVERDUE: {Math.abs(diffMins)}m (Pings: {ticket.slaBreaches})</span>;
                    } else if (diffMins <= 5) {
                      return <span className="badge ui-static-2996de5e80" > Due in: {diffMins}m (Pings: {ticket.slaBreaches})</span>;
                    } else {
                      return <span className="badge ui-static-ebf967d32d" > Due in: {diffMins}m (Pings: {ticket.slaBreaches})</span>;
                    }
                  })()}
                </div>
              )}
            </div>
          )}

          {ticket.actionItem && ticket.actionItem.meeting && (
            <div className="ui-static-fe61cac957" style={{display: 'flex', alignItems: 'center'}}>
              <span className="ui-static-7f8da12489" ></span>
              <p className="ui-static-72daf7908b" style={{flex: 1}}>
                <strong>Autogenerated Tracking Task:</strong> Originates from Meeting <a href={`/meetings/${ticket.actionItem.meeting.id}`} className="ui-static-348aace156" style={{textDecoration: 'underline'}}>{ticket.actionItem.meeting.title}</a>
              </p>
            </div>
          )}
          
          {(() => {
            let extractedName = "Unknown Reporter";
            const reporterMatch = ticket.description?.match(/\[Original Reporter: (.*?) -/);
            if (reporterMatch) {
              extractedName = reporterMatch[1];
            } else if (ticket.services && ticket.services.length > 0 && ticket.services[0].customer) {
              extractedName = ticket.services[0].customer.name;
            } else if (ticket.customData && typeof ticket.customData === 'object' && ticket.customData["Customer Name"]) {
               extractedName = ticket.customData["Customer Name"];
            }

            return (
              <div className="ui-static-b5e30dc658" style={{display: 'flex', flexWrap: 'wrap', alignItems: 'center'}}>
                <span className="ui-static-5f4bae914d" style={{display: 'flex', alignItems: 'center'}}>
                   <strong>{extractedName}</strong>
                </span>
                {ticket.customData && ticket.customData.hasDowntime && (
                  <span className="ui-static-422a1eafc4" style={{display: 'flex', alignItems: 'center', background: ticket.customData.endDowntime ? "var(--ui-warning-bg)" : "var(--ui-surface)", border: `1px solid ${ticket.customData.endDowntime ? "var(--ui-warning)" : "var(--ui-warning)"}`}}>
                     Downtime Outage: {formatDate(ticket.customData.startDowntime)} s/d {ticket.customData.endDowntime ? formatDate(ticket.customData.endDowntime) : 'Belum Selesai'} ({effectiveDowntimeMinutes(ticket.customData)} menit{ticket.customData.endDowntime ? '' : ' — live'})
                  </span>
                )}
                {ticket.customData && ticket.customData["Order Origin"] && (
                   <span className="ui-static-ad0950c73e" style={{display: 'flex', alignItems: 'center'}} title="Order Origin (Selling Company)">
                      {ticket.customData["Order Origin"]}
                   </span>
                )}
                {ticket.customData && ticket.customData["Executing Vendor"] && (
                   <span className="ui-static-db5f09cf58" style={{display: 'flex', alignItems: 'center'}} title="Executing Vendor">
                      {ticket.customData["Executing Vendor"]}
                   </span>
                )}
                <span>Handling Tech: <strong>{ticket.assignee?.name || ticket.assignee?.email || 'Unassigned'}</strong></span>
                <span>• <span>{mounted ? new Date(ticket.createdAt).toLocaleString('en-CA', { hour: '2-digit', minute: '2-digit' }) : '...'}</span></span>
              </div>
            );
          })()}
          
          <div className="ui-static-493a8e8c34" style={{whiteSpace: 'pre-wrap'}}>
            <p className="ui-static-072b12625d" >Dear NOC,</p>
            {!editingTicket && <p>Jenis pekerjaan: <strong>{ticket.serviceWorkTypeLabel || WORK_TYPE_LABELS[ticket.workType] || "Belum diklasifikasikan"}</strong>{["Installation", "ServiceWork"].includes(ticket.workType) && ticket.sapReference ? ` / SAP: ${ticket.sapReference}` : ""}{ticket.workType === "Trouble" ? ` / Gejala: ${ticket.symptomLabel || "—"} / Penyebab: ${ticket.causeLabel || "—"}` : ""}</p>}
            {ticket.serviceChange?.operation === 'BOD' ? <BodPanel ticket={ticket}/> : <ServiceWorkSummary ticket={ticket} />}
            <WorkPhasePanel ticketId={ticket.id} categories={jobCategories} canOverride={currentUser?.role === "Admin" || currentUser?.permissions?.includes("override_workflow_category")} />
            {editingTicket ? (
              <div>
                {!ticket.serviceChange?.appliedAt ? <>
                  <TicketWorkClassification value={{...formData,editExistingServiceWork:true}} services={services} serviceTemplates={serviceTemplates || []} onChange={patch => setFormData(previous => ({ ...previous, ...patch }))} />
                  {!["Trouble","ServiceWork"].includes(formData.workType) && <TicketServicePicker services={services} selectedIds={formData.serviceIds || []} onChange={serviceIds => setFormData(previous => ({ ...previous, serviceIds }))} />}
                </> : <p>Perubahan layanan sudah diterapkan. Buat tiket baru dari halaman CID untuk pekerjaan berikutnya.</p>}
                {/* Edit Customer / Reporter Name */}
                <div className="ui-static-3e8220669e" style={{position: 'relative'}} ref={customerWrapperRef}>
                  <label className="ui-static-340e8192d7" style={{display: 'block'}}>Customer / Reporter Name:</label>
                  {isAuthorized ? (
                    <>
                      <input 
                        type="text" 
                        placeholder="Cari dari Telecom Asset Inventory atau ketik manual..."
                        value={customerSearchTerm}
                        onChange={e => {
                          const val = e.target.value;
                          setCustomerSearchTerm(val);
                          setFormData({
                            ...formData,
                            customData: {
                              ...(formData.customData || {}),
                              "Customer Name": val
                            }
                          });
                          setIsCustomerDropdownOpen(true);
                        }}
                        onFocus={() => setIsCustomerDropdownOpen(true)}
                        className="ui-static-5786b7f14c" style={{width: '100%'}}
                      />
                      
                      {isCustomerDropdownOpen && customerSearchTerm.length >= 2 && (
                        <div 
                          className="ui-static-4a72d3d804" style={{position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 99, maxHeight: '200px', overflowY: 'auto'}}
                        >
                          {matchingCustomerServices.length > 0 ? (
                            <ul className="ui-static-0d59a3d063" style={{listStyle: 'none'}}>
                              {matchingCustomerServices.map(s => (
                                <li 
                                  key={s.id}
                                  onClick={() => handleSelectCustomerService(s)}
                                  className="ui-static-1bfa8b6ad5" style={{cursor: 'pointer'}}
                                  onMouseEnter={e => e.currentTarget.style.background = 'var(--hover-bg, #f1f5f9)'}
                                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                >
                                  <strong className="ui-static-94cf5c9a5e" >{s.customer?.name}</strong>: {s.name} <span className="ui-static-fc155e091a" style={{opacity: 0.6}}>({getServiceCid(s) || "CID belum tersedia"})</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <div className="ui-static-abaa5b1f0b" style={{textAlign: 'center'}}>
                              Tidak ada kecocokan di inventory. Ketikan Anda akan disimpan sebagai input manual.
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <input 
                      type="text" 
                      value={customerSearchTerm} 
                      disabled 
                      className="ui-static-eb797948b8" style={{width: '100%', cursor: 'not-allowed'}}
                    />
                  )}
                </div>

                {/* Edit Downtime Outage */}
                <div className="ui-static-1b75bd3b0e" >
                  <label className="ui-static-7aa1f2f55f" style={{display: 'flex', alignItems: 'center', cursor: 'pointer'}}>
                    <input 
                      type="checkbox" 
                      checked={formData.customData?.hasDowntime || false} 
                      onChange={e => {
                        const isChecked = e.target.checked;
                        setFormData({
                          ...formData,
                          customData: {
                            ...(formData.customData || {}),
                            hasDowntime: isChecked,
                            startDowntime: isChecked ? (formData.customData?.startDowntime || '') : null,
                            endDowntime: isChecked ? (formData.customData?.endDowntime || '') : null,
                            downtimeMinutes: isChecked ? (formData.customData?.downtimeMinutes || 0) : 0
                          }
                        });
                      }}
                      style={{ width: '1.1rem', height: '1.1rem', cursor: 'pointer' }}
                    />
                     Catat Waktu Outage / Downtime (Trouble Ticket)
                  </label>
                  
                  {formData.customData?.hasDowntime && (
                    <div className="ui-static-4b2b7b9e13" style={{display: 'grid', gridTemplateColumns: '1fr 1fr'}}>
                      <div>
                        <label className="ui-static-8eae2b6da2" style={{display: 'block'}}>Mulai Downtime</label>
                        <input 
                          type="datetime-local" 
                          value={toDatetimeLocalValue(formData.customData?.startDowntime)} 
                          onChange={e => {
                            const val = e.target.value;
                            const endDt = formData.customData?.endDowntime || '';
                            const duration = getDowntimeDuration(val, endDt);
                            setFormData({
                              ...formData,
                              customData: {
                                ...(formData.customData || {}),
                                startDowntime: val,
                                downtimeMinutes: (duration && !duration.error && !duration.ongoing) ? duration.minutes : 0
                              }
                            });
                          }} 
                          className="ui-static-a7b2f1ea69" style={{width: '100%'}}
                        />
                      </div>
                      <div>
                        <label className="ui-static-8eae2b6da2" style={{display: 'block'}}>
                          Selesai Downtime <span className="ui-static-3699709ad4" >(opsional)</span>
                        </label>
                        <div className="ui-static-30f523173e" style={{display: 'flex'}}>
                          <input 
                            type="datetime-local" 
                            value={toDatetimeLocalValue(formData.customData?.endDowntime)} 
                            onChange={e => {
                              const val = e.target.value;
                              const startDt = formData.customData?.startDowntime || '';
                              const duration = getDowntimeDuration(startDt, val);
                              setFormData({
                                ...formData,
                                customData: {
                                  ...(formData.customData || {}),
                                  endDowntime: val || null,
                                  downtimeMinutes: (duration && !duration.error && !duration.ongoing) ? duration.minutes : 0
                                }
                              });
                            }} 
                            className="ui-static-a7b2f1ea69" style={{flex: 1}}
                          />
                          <button
                            type="button"
                            className="secondary-btn ui-static-bc46fe7714"
                            style={{width: 'auto', whiteSpace: 'nowrap'}}
                            title="Set selesai = sekarang (WIB)"
                            onClick={() => {
                              const val = nowDatetimeLocal();
                              const startDt = formData.customData?.startDowntime || '';
                              const duration = getDowntimeDuration(startDt, val);
                              setFormData({
                                ...formData,
                                customData: {
                                  ...(formData.customData || {}),
                                  endDowntime: val,
                                  downtimeMinutes: (duration && !duration.error) ? duration.minutes : 0
                                }
                              });
                            }}
                            disabled={!formData.customData?.startDowntime}
                          >
                            Pulih sekarang
                          </button>
                        </div>
                      </div>
                      
                      {formData.customData?.startDowntime && (
                        <div className="ui-static-4ede6d8190" style={{gridColumn: '1 / -1', background: formData.customData?.endDowntime ? "var(--ui-surface)" : "var(--ui-surface)", border: `1px solid ${formData.customData?.endDowntime ? "var(--ui-success)" : "var(--ui-warning)"}`, color: formData.customData?.endDowntime ? "var(--ui-success)" : "var(--ui-warning)"}}>
                          {(() => {
                            const duration = getDowntimeDuration(formData.customData.startDowntime, formData.customData.endDowntime);
                            if (duration?.error) {
                              return <span className="ui-static-d087b501d0" > {duration.error}</span>;
                            }
                            return <span> Total Durasi Downtime: {duration?.text}</span>;
                          })()}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="ui-static-3e8220669e" >
                  <label className="ui-static-b2e12522e5" style={{display: 'block'}}>Deskripsi Tiket:</label>
                  <textarea 
                    ref={textareaRef}
                    value={editDesc} 
                    onChange={e => {
                      setEditDesc(e.target.value);
                      adjustTextareaHeight();
                    }} 
                    placeholder="Masukkan deskripsi detail kendala..."
                    className="ui-static-355fc1d005" style={{width: '100%', overflowY: 'hidden', resize: 'none', minHeight: '200px'}}
                  />
                </div>
                
                {customFields?.length > 0 && (
                  <div className="ui-static-8f27083c68" >
                    <h4 className="ui-static-7c4283a16f" >Configure Custom Parameters</h4>
                    <div className="ui-static-af81cc4264" style={{display: 'flex', flexDirection: 'column'}}>
                      {customFields.map(f => (
                        <div key={f.id} className="ui-static-6393964ce2" style={{display: 'grid', gridTemplateColumns: 'minmax(120px, 1fr) 3fr', alignItems: 'center'}}>
                          <label className="ui-static-b674ec9d7d" >{f.name}:</label>
                          {f.type === 'textarea' ? (
                            <textarea 
                              className="ui-static-5786b7f14c" style={{outline: 'none'}}
                              value={formData.customData?.[f.name] || ''}
                              onChange={e => setFormData({ ...formData, customData: { ...formData.customData, [f.name]: e.target.value }})}
                            />
                          ) : f.type === 'select' && (f.options?.trim() === '@Customers' || f.options === '@Customers') ? (
                            <AsyncSearchSelect
                              value={formData.customData?.[f.name] || ''}
                              onChange={(val) => setFormData({ ...formData, customData: { ...formData.customData, [f.name]: val }})}
                              placeholder="Search Customer..."
                              apiRoute="/api/assets/customers/search"
                              disabled={false}
                            />
                          ) : f.type === 'select' ? (
                            <SearchableSelect 
                              options={(f.options ? (function(){
                                if (f.options === '@ServiceTemplates') return (serviceTemplates || []).map(st => ({ value: st.name, label: st.name }));
                                try { return JSON.parse(f.options); } catch(e) { return f.options.split(',').map(s=>({value: s.trim(), label: s.trim()})); }
                              })() : [])}
                              value={formData.customData?.[f.name] || ''}
                              onChange={val => setFormData({ ...formData, customData: { ...formData.customData, [f.name]: val }})}
                              placeholder={`-- Select ${f.name} --`}
                            />
                          ) : (
                            <input 
                              type={f.type === 'date' ? 'date' : 'text'}
                              className="ui-static-5786b7f14c" style={{outline: 'none'}}
                              value={formData.customData?.[f.name] || ''}
                              onChange={e => setFormData({ ...formData, customData: { ...formData.customData, [f.name]: e.target.value }})}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="ui-static-8f27083c68" >
                  <label className="ui-static-e7c5f2f41a" style={{display: 'flex', alignItems: 'center', cursor: 'pointer'}}>
                    <input 
                      type="checkbox" 
                      checked={formData.enableSla} 
                      onChange={e => setFormData({ ...formData, enableSla: e.target.checked })} 
                      disabled={!canManageSla}
                      style={{ width: '1.2rem', height: '1.2rem', cursor: 'pointer' }}
                    />
                    Enable SLA Enforcement Timer for this ticket
                  </label>
                  {formData.enableSla && (
                    <div className="ui-static-5d44a1626d" style={{display: 'flex', alignItems: 'center'}}>
                      <input 
                        type="number" 
                        value={formData.slaTimerMins} 
                        onChange={e => setFormData({ ...formData, slaTimerMins: parseInt(e.target.value) || 15 })} 
                        min="5" max="1440" 
                        disabled={!canManageSla}
                        className="ui-static-1110c82e00" style={{width: '100px'}}
                      />
                      <span className="ui-static-c4f6d9efa4" >Minutes (frequency of CS follow-up pings)</span>
                    </div>
                  )}
                </div>

                <div className="ui-static-8451864047" style={{display: 'flex'}}>
                  <button onClick={saveTicketEdit} className="ui-static-378fd6cdab" style={{cursor: 'pointer'}}>Save Changes</button>
                  <button onClick={() => setEditingTicket(false)} className="ui-static-cf6242491a" style={{cursor: 'pointer'}}>Cancel</button>
                </div>
              </div>
            ) : (
              <div>
                <div dangerouslySetInnerHTML={{ __html: linkify(ticket.description) }} />
                
                {displayableCustomEntries(formData.customData).length > 0 && (
                  <div className="ui-static-fe041a7734" >
                    <h4 className="ui-static-10dbdcd9e9" >Attached Parameters</h4>
                    <div className="ui-static-e305c8eb6b" style={{display: 'grid'}}>
                      {displayableCustomEntries(formData.customData).map(([k, v]) => (
                        <div key={k} className="ui-static-af81cc4264" style={{display: 'grid', gridTemplateColumns: 'minmax(150px, 1fr) 4fr'}}>
                          <span className="ui-static-b9b52aa8d4" >{k}</span>
                          <span className="ui-static-bffd53f399" >{formatCustomValue(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {ticket.attachments && ticket.attachments.length > 0 && (
            <div className="ui-static-d52dc5b191" >
              <strong className="ui-static-d216f19693" style={{display: 'block'}}>Attachments ({ticket.attachments.length})</strong>
              <div className="ui-static-30f523173e" style={{display: 'flex', flexWrap: 'wrap'}}>
                {ticket.attachments.map(att => (
                   <a key={att.id} href={att.url} target="_blank" rel="noreferrer" className="ui-static-dfe620dfda" style={{textDecoration: 'none', display: 'flex', alignItems: 'center'}}>
                      {att.filename}
                   </a>
                ))}
              </div>
            </div>
          )}

        </div>

        {ticket.comments?.map(c => (
          <div key={c.id} className="ui-static-b8748b8852" >
            <div className="ui-static-62c8efff6b" style={{display: 'flex', justifyContent: 'space-between'}}>
              <span className="ui-static-fade3489ef" >
                Reply by <strong className="ui-static-bffd53f399" >{c.author?.name || c.author?.email}</strong>
                <span className="ui-static-656691997e" >&gt; <span>{mounted ? new Date(c.createdAt).toLocaleString('en-CA') : '...'}</span></span>
              </span>
              <span>
                {(c.authorId === currentUserId || isAuthorized) && (
                  <span onClick={() => { setEditingCommentId(c.id); setEditingCommentText(c.text); }} className="ui-static-b674ec9d7d" style={{cursor: 'pointer'}}>Edit</span>
                )}
              </span>
            </div>
            {editingCommentId === c.id ? (
              <div className="ui-static-fd5975142e" >
                <textarea rows="4" value={editingCommentText} onChange={e => setEditingCommentText(e.target.value)} className="ui-static-17db404fdb" style={{width: '100%', boxSizing: 'border-box'}} />
                <div className="ui-static-8451864047" style={{display: 'flex'}}>
                  <button onClick={() => saveCommentEdit(c.id)} className="ui-static-39b03e44ab" style={{cursor: 'pointer'}}>Update Save</button>
                  <button onClick={() => setEditingCommentId(null)} className="ui-static-4971779528" style={{cursor: 'pointer'}}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className="ui-static-04b359dbf2" style={{whiteSpace: 'pre-wrap'}} dangerouslySetInnerHTML={{ __html: linkify(c.text) }} />
            )}
            
            {c.attachments && c.attachments.length > 0 && (
              <div className="ui-static-d23a01b6ad" >
                 <div className="ui-static-30f523173e" style={{display: 'flex', flexWrap: 'wrap'}}>
                  {c.attachments.map(att => (
                     <a key={att.id} href={att.url} target="_blank" rel="noreferrer" className="ui-static-a79306a496" style={{textDecoration: 'none', display: 'flex', alignItems: 'center'}}>
                        {att.filename}
                     </a>
                  ))}
                </div>
              </div>
            )}
            
          </div>
        ))}

        <div className="ui-static-11d519e579" >
          <form onSubmit={handleCommentSubmit} className="ui-static-af81cc4264" style={{display: 'flex', flexDirection: 'column'}}>
            <div className="ui-static-af81cc4264" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap'}}>
              <h3 className="ui-static-c470735159" >Reply to ticket</h3>
              <label className="ui-static-68c4e844da" style={{display: 'flex', alignItems: 'center', cursor: 'pointer'}}>
                <input type="checkbox" checked={isPublicReply} onChange={(e) => setIsPublicReply(e.target.checked)} />
                Public reply (visible on track link)
              </label>
            </div>
            
            {optionalFields.length > 0 && (
              <div className="ui-static-18f7ac78e1" style={{display: 'flex', justifyContent: 'flex-end'}}>
                <div className="ui-static-aeec96aa52" style={{display: 'flex', alignItems: 'center'}}>
                  <span className="ui-static-c326169b80" >+ Tambah Parameter:</span>
                  <select 
                     defaultValue=""
                     className="ui-static-e6bf236d4c" style={{cursor: 'pointer', outline: 'none'}}
                     onChange={e => {
                       if(e.target.value) setVisibleCustomFieldIds([...visibleCustomFieldIds, parseInt(e.target.value)]);
                       e.target.value = "";
                     }}
                  >
                    <option value="">[ Pilih Field... ]</option>
                    {optionalFields.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
              </div>
            )}

            {visibleCustomFieldIds.length > 0 && (
              <div className="ui-static-72ae98d62a" style={{display: 'flex', flexDirection: 'column'}}>
                {customFields.filter(f => visibleCustomFieldIds.includes(f.id)).map(f => (
                  <div key={f.id} className="ui-static-6393964ce2" style={{display: 'grid', gridTemplateColumns: 'minmax(120px, 1fr) 3fr', alignItems: 'center'}}>
                    <label className="ui-static-b9b52aa8d4" >{f.name}:</label>
                    {f.type === 'textarea' ? (
                      <textarea 
                        className="ui-static-a5d32c45d4" style={{outline: 'none'}}
                        value={replyCustomData[f.name] || ''}
                        onChange={e => setReplyCustomData({ ...replyCustomData, [f.name]: e.target.value })}
                        required
                      />
                    ) : f.type === 'select' ? (
                      <SearchableSelect 
                        options={(f.options ? (function(){
                          if (f.options === '@ServiceTemplates') return (serviceTemplates || []).map(st => ({ value: st.name, label: st.name }));
                          try { return JSON.parse(f.options); } catch(e) { return f.options.split(',').map(s=>({ value: s.trim(), label: s.trim() })); }
                        })() : [])}
                        value={replyCustomData[f.name] || ''}
                        onChange={val => setReplyCustomData({ ...replyCustomData, [f.name]: val })}
                        placeholder={`-- Select ${f.name} --`}
                        required
                      />
                    ) : (
                      <input 
                        type={f.type === 'date' ? 'date' : 'text'}
                        className="ui-static-a5d32c45d4" style={{outline: 'none'}}
                        value={replyCustomData[f.name] || ''}
                        onChange={e => setReplyCustomData({ ...replyCustomData, [f.name]: e.target.value })}
                        required
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Knowledge Base search removed by user request */}

            <div style={{ position: 'relative' }}>
              <textarea 
                rows="6" 
                placeholder="Type your technical response here..." 
                className="ui-static-0e44beab41" style={{width: '100%', boxSizing: 'border-box'}}
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                required={!file && visibleCustomFieldIds.length === 0}
              ></textarea>
            </div>

            {canManageSla && (
              <div className="ui-static-c394f4ea60" style={{display: 'flex', flexDirection: 'column'}}>
                <label className="ui-static-e9bf855066" style={{display: 'flex', alignItems: 'center', cursor: 'pointer'}}>
                  <input 
                    type="checkbox" 
                    checked={replyEnableSla} 
                    onChange={e => setReplyEnableSla(e.target.checked)} 
                    style={{ width: '1.2rem', height: '1.2rem', cursor: 'pointer' }}
                  />
                  Reactivate / Modify External SLA Timer
                </label>
                {replyEnableSla && (
                  <div className="ui-static-c3b27cc598" style={{display: 'flex', alignItems: 'center'}}>
                    <input 
                      type="number" 
                      value={replySlaMins} 
                      onChange={e => setReplySlaMins(parseInt(e.target.value))} 
                      min="5" max="1440" 
                      className="ui-static-2bf089dea9" style={{width: '80px'}}
                    />
                    <span className="ui-static-dd90b11840" >Minutes (Ticket Original: {ticket?.slaTimerMins || 15}m)</span>
                  </div>
                )}
              </div>
            )}

            <div className="ui-static-5783191274" style={{display: 'flex', alignItems: 'center'}}>
              <label className="ui-static-f44d951558" style={{minWidth: '100px'}}>Attachment:</label>
              <input type="file" onChange={e => setFile(e.target.files[0])} className="ui-static-2cd1b44acf" style={{flex: 1}} />
              {file && <span className="ui-static-5e6e0287a2" >Added ✓</span>}
            </div>

            {commentError && <p role="alert" style={{margin: '0 0 0.75rem', color: 'var(--danger-text)'}}>{commentError}</p>}
            <div className="ui-static-58450472e8" style={{display: 'flex', justifyContent: 'flex-end', alignItems: 'center'}}>
              <div className="ui-static-791d011e41" style={{position: 'relative', display: 'inline-flex'}}>
                <button type="button" onClick={(e) => handleCommentSubmit(e, submitAction)} disabled={commentLoading} className="ui-static-48db7c15bb" style={{background: submitAction === 'finish' ? "var(--ui-success)" : "var(--ui-info)", cursor: 'pointer', transition: 'background 0.2s'}}>
                  {commentLoading ? 'Sending...' : (submitAction === 'finish' ? 'Submit & Mark Finished' : 'Submit Reply')}
                </button>
                <button type="button" onClick={() => setShowSubmitDropdown(!showSubmitDropdown)} disabled={commentLoading} className="ui-static-464af54656" style={{background: submitAction === 'finish' ? "var(--ui-success)" : "var(--ui-info)", cursor: 'pointer', borderLeft: `1px solid ${submitAction === 'finish' ? "var(--ui-success)" : "var(--ui-info)"}`, transition: 'background 0.2s'}}>
                  <span className="ui-static-56a9a1da55" >▼</span>
                </button>
                
                {showSubmitDropdown && (
                  <div className="ui-static-4c5f93b5d3" style={{position: 'absolute', top: '100%', right: 0, zIndex: 10, minWidth: '220px', overflow: 'hidden'}}>
                    <div onClick={() => { setSubmitAction('reply'); setShowSubmitDropdown(false); }} className="ui-static-f04999b5c0" style={{cursor: 'pointer', background: submitAction === 'reply' ? 'var(--hover-bg)' : 'var(--card-bg)', fontWeight: submitAction === 'reply' ? 'bold' : 'normal'}}>
                      <div className="ui-static-137aa26511" >Submit Reply</div>
                      <span className="ui-static-aadf8c75a4" >Status shifts automatically</span>
                    </div>
                    <div onClick={() => { setSubmitAction('finish'); setShowSubmitDropdown(false); }} className="ui-static-f4b1b3c6e4" style={{cursor: 'pointer', background: submitAction === 'finish' ? 'var(--hover-bg)' : 'var(--card-bg)', fontWeight: submitAction === 'finish' ? 'bold' : 'normal'}}>
                      <div className="ui-static-137aa26511" >Submit & Mark Finished</div>
                      <span className="ui-static-aadf8c75a4" >Status shifts to Finish</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </form>
        </div>

      </div>

      <div className="ui-static-92254f43e7" style={{display: 'flex', flexDirection: 'column'}}>
        
        {ticket.enableSla && ticket.status !== 'Resolved' && ticket.status !== 'Waiting Reply' && (
           <div className="no-print ui-static-af064c5623" >
             <h3 className="ui-static-00c0f4f797" >SLA Enforcement Active</h3>
             <p className="ui-static-0afa5dcabc" >The Customer Service team is required to follow up with the customer every {ticket.slaTimerMins} minutes.</p>
             <button 
               onClick={async () => {
                 setSlaLoading(true);
                 const res = await fetch(`/api/tickets/${ticket.id}/sla-follow-up`, { method: "POST" });
                 if(res.ok) router.refresh();
                 else toast.error("Failed to log follow-up.");
                 setSlaLoading(false);
               }} 
               disabled={slaLoading}
               className="ui-static-a7283a26a2" style={{width: '100%', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center'}}
             >
               {slaLoading ? 'Logging...' : '↻ Log Follow-Up (Ext. Channel)'}
             </button>
           </div>
        )}

        <div className="no-print ui-static-30f523173e" style={{display: 'flex'}}>
          {showTicketEdit && (
            <button onClick={() => setEditingTicket(true)} className="btn btn-primary btn-fit ui-static-bffbf1dba5" style={{flex: 1, cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
              <span className="ui-static-635656024d" ></span> Edit
            </button>
          )}
          <button onClick={() => window.print()} className="print-btn ui-static-bffbf1dba5" style={{flex: 1, cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
            <span className="ui-static-635656024d" ></span> Print
          </button>
          {canDelete && (
            <button onClick={handleDelete} className="btn btn-danger-ghost btn-fit ui-static-9520b8c320" style={{cursor: 'pointer'}}> Delete</button>
          )}
        </div>

        <div className="ui-static-5bc6e4fcaa" >
          <div className="ui-static-6ef8599ce0" style={{display: 'flex', flexDirection: 'column'}}>
             
             <div className="ui-static-0f8796a915" style={{display: 'flex', flexDirection: 'column'}}>
               <label htmlFor="ticket-status" className="ui-static-b55d0546e4" style={{textTransform: 'uppercase'}}>Ticket Status</label>
               <select id="ticket-status" className="ui-static-af51282eb0 ticket-status-control" style={{width: '100%', ...statusStyle(formData.status), cursor: canChangeStatus ? 'pointer' : 'not-allowed'}} value={formData.status} onChange={e => { const next = e.target.value; if (next === 'Closed' && !window.confirm('Tutup tiket ini? Tiket Closed keluar dari antrean aktif dan hanya dapat dibuka kembali oleh pengguna berizin.')) return; triggerAutoSave('status', next); }} disabled={!canChangeStatus}>
                 <option value="New">New</option>
                 <option value="Open">Open</option>
                 <option value="In Progress">In Progress</option>
                 <option value="Pending">Pending (Waiting User)</option>
                 <option value="On Hold">On Hold</option>
                 <option value="Finish">Finish</option>
                 <option value="Resolved">Resolved</option>
                 <option value="Closed">Closed</option>
               </select>
             </div>

             <div>
               <label className="ui-static-117fa0fe87" style={{display: 'block', textTransform: 'uppercase'}}>Type</label>
               <select className="ui-static-f6cbecb93c" style={{width: '100%'}} value={formData.ticketType} onChange={e => triggerAutoSave('ticketType', e.target.value)} disabled={!canModifyTicket}>
                 <option value="Incident">Incident</option>
                 <option value="Problem">Problem</option>
                 <option value="Change">Change</option>
                 <option value="Request">Request</option>
               </select>
             </div>

             {formData.ticketType === 'Change' && (
               <div>
                 <label className="ui-static-117fa0fe87" style={{display: 'block', textTransform: 'uppercase'}}>Approval</label>
                 <select className="ui-static-f6cbecb93c" style={{width: '100%'}} value={formData.approvalStatus || 'Pending'} onChange={e => triggerAutoSave('approvalStatus', e.target.value)} disabled={!isAdminOrManager}>
                   <option value="Pending">Pending</option>
                   <option value="Approved">Approved</option>
                   <option value="Rejected">Rejected</option>
                 </select>
               </div>
             )}

             <button
               type="button"
               onClick={async () => {
                 if (watching) {
                   await fetch(`/api/tickets/${ticket.id}/watchers?userId=${currentUserId}`, { method: 'DELETE' });
                   setWatching(false);
                 } else {
                   await fetch(`/api/tickets/${ticket.id}/watchers`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
                   setWatching(true);
                 }
               }}
               className="ui-static-962506c519" style={{width: '100%', background: watching ? 'var(--secondary-color)' : 'var(--card-bg)', color: watching ? "var(--ui-on-accent)" : 'var(--heading-color)', cursor: 'pointer'}}
             >
               {watching ? 'Watching' : 'Watch ticket'}
             </button>
             
             <div className="ui-static-0f8796a915" style={{display: 'flex', flexDirection: 'column'}}>
               <label className="ui-static-b55d0546e4" style={{textTransform: 'uppercase'}}>Priority Level</label>
               <select className="ui-static-6cfc858e3f" style={{width: '100%', color: formData.priority === 'Critical' ? "var(--ui-danger)" : 'var(--input-text)', cursor: 'pointer', outline: 'none'}} value={formData.priority} onChange={e => triggerAutoSave('priority', e.target.value)} disabled={!canChangeStatus}>
                 <option value="Low">Low</option>
                 <option value="Medium">Medium</option>
                 <option value="High">High</option>
                 <option value="Critical">Critical</option>
               </select>
             </div>
             
             <div className="ui-static-0f8796a915" style={{display: 'flex', flexDirection: 'column'}}>
               <label className="ui-static-b55d0546e4" style={{textTransform: 'uppercase'}}>Department</label>
               <SearchableSelect 
                  options={(departments || []).map(d => ({ value: d.id, label: d.name }))} 
                  value={formData.departmentId} 
                  onChange={val => triggerAutoSave('departmentId', val)} 
                  disabled={!canAssign} 
                  placeholder="-- Select Department --" 
                />
            </div>

             <div className="ui-static-0f8796a915" style={{display: 'flex', flexDirection: 'column'}}>
               <label className="ui-static-d6117e520d" style={{textTransform: 'uppercase'}}>Assigned To</label>
               <SearchableSelect 
                 options={users.map(u => ({ value: u.id, label: u.name || u.email }))} 
                 value={formData.assigneeId} 
                 onChange={val => triggerAutoSave('assigneeId', val)} 
                 disabled={!canAssign} 
                 placeholder="-- Unassigned --" 
               />
             </div>
             
             <div className="ui-static-0f8796a915" style={{display: 'flex', flexDirection: 'column'}}>
               <label className="ui-static-d6117e520d" style={{textTransform: 'uppercase'}}>Job Phase Category</label>
               <SearchableSelect 
                 options={(jobCategories || []).map(c => ({ value: c.id, label: canChangeJobCategory ? `${c.name} (+${c.score} pt)` : c.name }))} 
                 value={formData.jobCategoryId} 
                 onChange={val => triggerAutoSave('jobCategoryId', val)} 
                 disabled={!canChangeJobCategory} 
                 placeholder="-- Phase Unassigned --" 
               />
             </div>
          </div>
        </div>

        <div className="ui-static-5bc6e4fcaa" >
          <h3 className="ui-static-99fe73b704" >Ticket Details</h3>
          
          <div className="ui-static-e305c8eb6b" style={{display: 'flex', flexDirection: 'column'}}>
            <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr' }}>
              <span className="ui-static-fade3489ef" >Tracking ID:</span>
              <span className="ui-static-8356576a3b" >{ticket.trackingId}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr' }}>
              <span className="ui-static-fade3489ef" >Ticket #:</span>
              <span className="ui-static-bffd53f399" >{ticket.id}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr' }}>
              <span className="ui-static-fade3489ef" >Created on:</span>
              <span className="ui-static-bffd53f399" >{mounted ? new Date(ticket.createdAt).toLocaleString('en-CA') : '...'}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr' }}>
              <span className="ui-static-fade3489ef" >Updated:</span>
              <span className="ui-static-bffd53f399" >{mounted ? new Date(ticket.updatedAt).toLocaleString('en-CA') : '...'}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr' }}>
              <span className="ui-static-fade3489ef" >Replies:</span>
              <span className="ui-static-bffd53f399" >{ticket.comments?.length || 0}</span>
            </div>
          </div>
        </div>



          {ticket.services && ticket.services.length > 0 && (
            <div className="ui-static-5bc6e4fcaa" >
              <h3 className="ui-static-69e2bff81d" >Network Topology (Impacted)</h3>
              <div className="ui-static-af81cc4264" style={{display: 'flex', flexDirection: 'column'}}>
                {ticket.services.map(srv => (
                  <div key={srv.id} className="ui-static-8ac40da837" >
                    <div className="ui-static-a5e625c9ab" >{srv.customer?.name}</div>
                    <div className="ui-static-925c9f8d18" >{srv.name}</div>
                    
                    {srv.hops && srv.hops.length > 0 ? (
                      <div className="ui-static-560df0ec4d" style={{display: 'flex', flexDirection: 'column', position: 'relative'}}>
                        {srv.hops.map((hop, i) => (
                          <div key={hop.id} className="ui-static-2a6a66339b" style={{position: 'relative'}}>
                            <div className="ui-static-10fcb7e09f" style={{position: 'absolute', left: '-1.15rem', top: '10px', width: '10px', height: '10px'}}></div>
                            <div className="ui-static-a849bc9536" >{hop.location}</div>
                            <div className="ui-static-ee85763f8f" >{hop.deviceName} • {hop.portName}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="ui-static-2748f1debd" >No routing hops mapped.</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

        {/* Activity Notes Panel (Phase 34) */}
        {canViewNotes && (
          <div className="ui-static-5bc6e4fcaa" >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: notesExpanded ? '1rem' : '0', cursor: 'pointer' }} onClick={() => setNotesExpanded(!notesExpanded)}>
              <h3 className="ui-static-9c15ba00ea" style={{display: 'flex', alignItems: 'center'}}>
                Activity Notes
                <span className="ui-static-3669036e4a" >{notes.length}</span>
              </h3>
              <span className="ui-static-06c91ad709" style={{transform: notesExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s'}}>▼</span>
            </div>

            {notesExpanded && (
              <>
                {canWriteNotes && (
                  <div className="ui-static-d5e9b5a921" >
                    <div className="ui-static-fd3a6e970b" style={{display: 'flex', flexWrap: 'wrap'}}>
                      {[
                        { value: 'internal', label: 'Internal', color: "var(--ui-info)" },
                        { value: 'follow_up', label: 'Follow-up', color: "var(--ui-warning)" },
                        { value: 'escalation', label: 'Escalation', color: "var(--ui-danger)" },
                        { value: 'customer_update', label: 'Customer', color: "var(--ui-success)" }
                      ].map(t => (
                        <button
                          key={t.value}
                          type="button"
                          onClick={() => setNoteType(t.value)}
                          className="ui-static-f45b65a91c" style={{cursor: 'pointer', transition: 'all 0.2s', background: noteType === t.value ? t.color : 'var(--card-bg)', color: noteType === t.value ? "var(--ui-on-accent)" : 'var(--text-color)', outline: noteType === t.value ? 'none' : '1px solid var(--border-color)'}}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                    <textarea
                      rows="2"
                      placeholder="Tambah catatan internal..."
                      value={noteContent}
                      onChange={e => setNoteContent(e.target.value)}
                      className="ui-static-8fb259e6db" style={{width: '100%', boxSizing: 'border-box', resize: 'vertical'}}
                    />
                    <button
                      type="button"
                      disabled={noteLoading || !noteContent.trim()}
                      onClick={async () => {
                        setNoteLoading(true);
                        try {
                          const res = await fetch(`/api/tickets/${ticket.id}/notes`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ content: noteContent, noteType })
                          });
                          if (res.ok) {
                            const newNote = await res.json();
                            setNotes([newNote, ...notes]);
                            setNoteContent("");
                          }
                        } catch (err) {}
                        setNoteLoading(false);
                      }}
                      className="ui-static-62ec63d195" style={{width: '100%', cursor: noteContent.trim() ? 'pointer' : 'not-allowed', opacity: noteContent.trim() ? 1 : 0.5}}
                    >
                      {noteLoading ? 'Saving...' : 'Add note'}
                    </button>
                  </div>
                )}

                <div className="ui-static-30f523173e" style={{display: 'flex', flexDirection: 'column', maxHeight: '350px', overflowY: 'auto'}}>
                  {notes.length === 0 && (
                    <div className="ui-static-a099e950e5" style={{textAlign: 'center', fontStyle: 'italic'}}>Belum ada catatan. Tambahkan note pertama di atas.</div>
                  )}
                  {notes.map(note => {
                    const typeConfig = {
                      internal: { color: "var(--ui-info)", label: 'Internal' },
                      follow_up: { color: "var(--ui-warning)", label: 'Follow-up' },
                      escalation: { color: "var(--ui-danger)", label: 'Escalation' },
                      customer_update: { color: "var(--ui-success)", label: 'Customer' }
                    };
                    const cfg = typeConfig[note.noteType] || typeConfig.internal;
                    return (
                      <div key={note.id} className="ui-static-d8ea554952" style={{borderLeft: `3px solid ${cfg.color}`}}>
                        <div className="ui-static-137aa26511" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                          <span className="ui-static-0db2f5adb4" style={{color: cfg.color, textTransform: 'uppercase'}}>
                            {cfg.label}
                          </span>
                          <span className="ui-static-291febf571" >{mounted ? new Date(note.createdAt).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '...'}</span>
                        </div>
                        <p className="ui-static-279b24b0bc" style={{whiteSpace: 'pre-wrap'}}>{note.content}</p>
                        <span className="ui-static-291febf571" >— {note.author?.name || note.author?.email}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        <div className="ui-static-5bc6e4fcaa" >
          <h3 className="ui-static-f226468cdc" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <span>Ticket History</span>
            <span className="ui-static-06c91ad709" >ʌ</span>
          </h3>
          <ul className="ui-static-9d965ed3cc" style={{listStyle: 'none', display: 'flex', flexDirection: 'column'}}>
            {(!ticket.historyLogs || ticket.historyLogs.length === 0) && (
              <li className="ui-static-60700bd225" >No history entries logged yet.</li>
            )}
            {ticket.historyLogs?.slice(0, 5).map(log => {
               const d = new Date(log.createdAt);
               const dateStr = d.toLocaleDateString('en-CA');
               const timeStr = d.toLocaleTimeString('en-GB', {hour12: false});
               const authorName = log.actor?.name || log.actor?.email?.split('@')[0] || 'System';
               return (
                <li key={log.id} className="ui-static-4fa2e9d873" style={{display: 'grid', gridTemplateColumns: '80px 1fr', alignItems: 'flex-start'}}>
                  <div className="ui-static-3214ddca0f" style={{display: 'flex', flexDirection: 'column'}}>
                    <span>{mounted ? dateStr : '...'}</span>
                    <span>{mounted ? timeStr : '...'}</span>
                  </div>
                  <div className="ui-static-6a26d99d37" >
                    <span>{log.action}</span><br/>
                    <span className="ui-static-fade3489ef" >by {authorName}</span>
                  </div>
                </li>
               );
            })}
          </ul>
          {ticket.historyLogs?.length > 5 && (
            <button onClick={() => setShowHistoryModal(true)} className="ui-static-f16a6a702e" style={{width: '100%', cursor: 'pointer'}}>
              View Full History ({ticket.historyLogs.length})
            </button>
          )}
        </div>

      </div>

      {showHistoryModal && (
        <div className="modal-overlay" onClick={() => setShowHistoryModal(false)} role="presentation">
          <div className="modal-panel ui-static-39c1d6c828"  onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Full Audit History">
            <div className="ui-static-377c070215" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <h2 className="ui-static-c470735159" >Full Audit History</h2>
              <button onClick={() => setShowHistoryModal(false)} className="ui-static-6a560df0e4" style={{width: '32px', height: '32px', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer'}}>✕</button>
            </div>
            <div className="ui-static-b7a907b44e" style={{overflowY: 'auto', flex: 1}}>
              <ul className="ui-static-0d59a3d063" style={{listStyle: 'none', display: 'flex', flexDirection: 'column'}}>
                {ticket.historyLogs.map(log => {
                   const d = new Date(log.createdAt);
                   const dateStr = d.toLocaleDateString('en-CA');
                   const timeStr = d.toLocaleTimeString('en-GB', {hour12: false});
                   const authorName = log.actor?.name || log.actor?.email?.split('@')[0] || 'System';
                   return (
                    <li key={log.id} className="ui-static-e5ce4ba115" style={{display: 'grid', gridTemplateColumns: '90px 1fr', alignItems: 'flex-start'}}>
                      <div className="ui-static-91fc78cb3b" style={{display: 'flex', flexDirection: 'column'}}>
                        <span className="ui-static-8356576a3b" >{mounted ? dateStr : '...'}</span>
                        <span>{mounted ? timeStr : '...'}</span>
                      </div>
                      <div className="ui-static-504a7ff39b" >
                        <span className="ui-static-af5bb0afde" >{log.action}</span><br/>
                        <span className="ui-static-32cddf2bca" >Actor: <strong className="ui-static-bffd53f399" >{authorName}</strong></span>
                      </div>
                    </li>
                   );
                })}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
